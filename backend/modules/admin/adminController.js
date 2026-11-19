const fs = require('fs');
const path = require('path');
const db = require('../../config/db');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

function removeUploadedFile(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/api/uploads/')) return;
  const rel = imageUrl.replace('/api/uploads/', '');
  const fullPath = path.join(UPLOADS_ROOT, rel);
  fs.promises.unlink(fullPath).catch(() => {});
}

function removeReqFile(file) {
  if (file?.path) {
    fs.promises.unlink(file.path).catch(() => {});
  }
}

const ALLOWED_STATUSES = ['Active', 'Inactive', 'Suspended'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MODULE_TYPES = ['Marketplace', 'Lost_Found', 'Both'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const ENTITY_CONFIG = {
  campuses: {
    table: 'campuses',
    singular: 'campus',
    idKey: 'campus_id',
    orderBy: 'campus_id ASC',
    fields: ['campus_code', 'campus_name'],
    childChecks: [
      { table: 'buildings', col: 'campus_id', label: 'building(s)' },
      { table: 'm_items', col: 'campus_id', label: 'marketplace listing(s)' },
      { table: 'lf_items', col: 'campus_id', label: 'lost & found report(s)' }
    ],
    validate(body) {
      const campus_code = String(body.campus_code ?? '').trim();
      const campus_name = String(body.campus_name ?? '').trim();
      if (!campus_code || !campus_name) {
        return { error: 'Campus code and campus name are required.' };
      }
      return { data: { campus_code, campus_name } };
    }
  },
  buildings: {
    table: 'buildings',
    singular: 'building',
    idKey: 'building_id',
    orderBy: 'building_id ASC',
    fields: ['campus_id', 'building_code', 'building_name', 'image_url'],
    childChecks: [
      { table: 'rooms', col: 'building_id', label: 'room(s)' }
    ],
    validate(body, { file, existingRecord } = {}) {
      const campus_id = Number(body.campus_id);
      const building_code = String(body.building_code ?? '').trim();
      const building_name = String(body.building_name ?? '').trim();
      if (!Number.isInteger(campus_id) || campus_id <= 0) {
        return { error: 'A valid campus is required.' };
      }
      if (!building_code || !building_name) {
        return { error: 'Building code and building name are required.' };
      }
      const image_url = file
        ? `/api/uploads/buildings/${file.filename}`
        : existingRecord?.image_url || '';
      if (!image_url) {
        return { error: 'Building image (JPEG or PNG) is required.' };
      }
      return { data: { campus_id, building_code, building_name, image_url } };
    }
  },
  rooms: {
    table: 'rooms',
    singular: 'room',
    idKey: 'room_id',
    orderBy: 'room_id ASC',
    fields: ['building_id', 'room_code'],
    childChecks: [
      { table: 'class_schedules', col: 'room_id', label: 'class schedule(s)' }
    ],
    validate(body) {
      const building_id = Number(body.building_id);
      const room_code = String(body.room_code ?? '').trim();
      if (!Number.isInteger(building_id) || building_id <= 0) {
        return { error: 'A valid building is required.' };
      }
      if (!room_code) {
        return { error: 'Room code is required.' };
      }
      return { data: { building_id, room_code } };
    }
  },
  schedules: {
    table: 'class_schedules',
    singular: 'schedule',
    idKey: 'schedule_id',
    orderBy: 'schedule_id ASC',
    fields: ['room_id', 'day_of_week', 'start_time', 'end_time'],
    childChecks: [],
    validate(body) {
      const room_id = Number(body.room_id);
      const day_of_week = String(body.day_of_week ?? '').trim();
      const start_time = String(body.start_time ?? '').trim();
      const end_time = String(body.end_time ?? '').trim();
      if (!Number.isInteger(room_id) || room_id <= 0) {
        return { error: 'A valid room is required.' };
      }
      if (!DAYS_OF_WEEK.includes(day_of_week)) {
        return { error: 'A valid day of the week is required.' };
      }
      if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
        return { error: 'Valid start and end times are required.' };
      }
      if (start_time.slice(0, 5) >= end_time.slice(0, 5)) {
        return { error: 'End time must be later than start time.' };
      }
      return { data: { room_id, day_of_week, start_time, end_time } };
    }
  },
  categories: {
    table: 'categories',
    singular: 'category',
    idKey: 'category_id',
    orderBy: 'category_id ASC',
    fields: ['category_name', 'module_type'],
    childChecks: [
      { table: 'm_items', col: 'category_id', label: 'marketplace listing(s)' },
      { table: 'lf_items', col: 'category_id', label: 'lost & found report(s)' }
    ],
    validate(body) {
      const category_name = String(body.category_name ?? '').trim();
      const module_type = String(body.module_type ?? '').trim();
      if (!category_name) {
        return { error: 'Category name is required.' };
      }
      if (!MODULE_TYPES.includes(module_type)) {
        return { error: 'A valid module type is required.' };
      }
      return { data: { category_name, module_type } };
    }
  }
};

exports.getStats = async (req, res) => {
  try {
    const [[users]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(account_status = 'Active'), 0) AS active,
         COALESCE(SUM(account_status = 'Inactive'), 0) AS inactive,
         COALESCE(SUM(account_status = 'Suspended'), 0) AS suspended
       FROM users WHERE role = 'Student'`
    );
    const [[reference]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM campuses) AS campuses,
         (SELECT COUNT(*) FROM buildings) AS buildings,
         (SELECT COUNT(*) FROM rooms) AS rooms,
         (SELECT COUNT(*) FROM class_schedules) AS schedules,
         (SELECT COUNT(*) FROM categories) AS categories`
    );
    const [recentUsers] = await db.query(
      `SELECT user_id, student_id, full_name, account_status, created_at
       FROM users WHERE role = 'Student'
       ORDER BY created_at DESC, user_id DESC
       LIMIT 5`
    );
    return res.json({ users, reference, recentUsers });
  } catch (error) {
    console.error('getStats error:', error);
    return res.status(500).json({ error: 'Failed to load statistics.' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT user_id, student_id, full_name, email, account_status, created_at
       FROM users WHERE role = 'Student' ORDER BY user_id DESC`
    );
    return res.json({ users: rows });
  } catch (error) {
    console.error('listUsers error:', error);
    return res.status(500).json({ error: 'Failed to load users.' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(userId) || userId <= 0 || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid user or status.' });
    }

    const [rows] = await db.query('SELECT role, account_status FROM users WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (rows[0].role !== 'Student') {
      return res.status(403).json({ error: 'Only student accounts can be modified here.' });
    }
    if (rows[0].account_status === 'Inactive') {
      return res.status(403).json({ error: 'Unverified accounts cannot be activated by an administrator.' });
    }

    await db.query('UPDATE users SET account_status = ? WHERE user_id = ?', [status, userId]);
    return res.json({ success: true, user_id: userId, account_status: status });
  } catch (error) {
    console.error('updateUserStatus error:', error);
    return res.status(500).json({ error: 'Failed to update account status.' });
  }
};

exports.getSystemData = async (req, res) => {
  try {
    const [
      [campuses],
      [buildings],
      [rooms],
      [schedules],
      [categories]
    ] = await Promise.all([
      db.query('SELECT campus_id, campus_code, campus_name FROM campuses ORDER BY campus_id ASC'),
      db.query('SELECT building_id, campus_id, building_code, building_name, image_url FROM buildings ORDER BY building_id ASC'),
      db.query('SELECT room_id, building_id, room_code FROM rooms ORDER BY room_id ASC'),
      db.query('SELECT schedule_id, room_id, day_of_week, start_time, end_time FROM class_schedules ORDER BY schedule_id ASC'),
      db.query('SELECT category_id, category_name, module_type FROM categories ORDER BY category_id ASC')
    ]);

    return res.json({ campuses, buildings, rooms, schedules, categories });
  } catch (error) {
    console.error('getSystemData error:', error);
    return res.status(500).json({ error: 'Failed to load system reference data.' });
  }
};

exports.createSystemRecord = async (req, res) => {
  const cfg = ENTITY_CONFIG[req.params.entity];
  if (!cfg) {
    removeReqFile(req.file);
    return res.status(404).json({ error: 'Unknown reference entity.' });
  }

  const { error: valError, data } = cfg.validate(req.body, { file: req.file });
  if (valError) {
    removeReqFile(req.file);
    return res.status(400).json({ error: valError });
  }

  try {
    const cols = cfg.fields.join(', ');
    const placeholders = cfg.fields.map(() => '?').join(', ');
    const values = cfg.fields.map((f) => data[f]);

    const [result] = await db.query(
      `INSERT INTO ${cfg.table} (${cols}) VALUES (${placeholders})`,
      values
    );

    const [rows] = await db.query(
      `SELECT * FROM ${cfg.table} WHERE ${cfg.idKey} = ?`,
      [result.insertId]
    );
    return res.status(201).json({ record: rows[0] });
  } catch (error) {
    removeReqFile(req.file);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A record with that unique value already exists.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Selected parent reference does not exist.' });
    }
    console.error('createSystemRecord error:', error);
    return res.status(500).json({ error: 'Failed to create record.' });
  }
};

exports.updateSystemRecord = async (req, res) => {
  const cfg = ENTITY_CONFIG[req.params.entity];
  if (!cfg) {
    removeReqFile(req.file);
    return res.status(404).json({ error: 'Unknown reference entity.' });
  }

  const recordId = Number(req.params.id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    removeReqFile(req.file);
    return res.status(400).json({ error: 'Invalid record ID.' });
  }

  try {
    const [existing] = await db.query(
      `SELECT * FROM ${cfg.table} WHERE ${cfg.idKey} = ?`,
      [recordId]
    );
    if (existing.length === 0) {
      removeReqFile(req.file);
      return res.status(404).json({ error: 'Record not found.' });
    }

    const existingRecord = existing[0];
    const { error: valError, data } = cfg.validate(req.body, { file: req.file, existingRecord });
    if (valError) {
      removeReqFile(req.file);
      return res.status(400).json({ error: valError });
    }

    const sets = cfg.fields.map((f) => `${f} = ?`).join(', ');
    const values = [...cfg.fields.map((f) => data[f]), recordId];

    await db.query(
      `UPDATE ${cfg.table} SET ${sets} WHERE ${cfg.idKey} = ?`,
      values
    );

    if (req.file && existingRecord.image_url && existingRecord.image_url !== data.image_url) {
      removeUploadedFile(existingRecord.image_url);
    }

    const [rows] = await db.query(
      `SELECT * FROM ${cfg.table} WHERE ${cfg.idKey} = ?`,
      [recordId]
    );
    return res.json({ record: rows[0] });
  } catch (error) {
    removeReqFile(req.file);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A record with that unique value already exists.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Selected parent reference does not exist.' });
    }
    console.error('updateSystemRecord error:', error);
    return res.status(500).json({ error: 'Failed to update record.' });
  }
};

exports.deleteSystemRecord = async (req, res) => {
  const cfg = ENTITY_CONFIG[req.params.entity];
  if (!cfg) {
    return res.status(404).json({ error: 'Unknown reference entity.' });
  }

  const recordId = Number(req.params.id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ error: 'Invalid record ID.' });
  }

  try {
    const [existing] = await db.query(
      `SELECT * FROM ${cfg.table} WHERE ${cfg.idKey} = ?`,
      [recordId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    for (const check of cfg.childChecks) {
      const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM ${check.table} WHERE ${check.col} = ?`,
        [recordId]
      );
      if (cnt > 0) {
        return res.status(409).json({
          error: `Cannot delete this ${cfg.singular} while ${cnt} dependent ${check.label} still exist. Delete those first.`
        });
      }
    }

    await db.query(
      `DELETE FROM ${cfg.table} WHERE ${cfg.idKey} = ?`,
      [recordId]
    );

    if (existing[0].image_url) {
      removeUploadedFile(existing[0].image_url);
    }

    return res.json({ success: true, deletedId: recordId });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: `Cannot delete this ${cfg.singular} because dependent records still exist.`
      });
    }
    console.error('deleteSystemRecord error:', error);
    return res.status(500).json({ error: 'Failed to delete record.' });
  }
};

const LISTING_TYPES = ['marketplace', 'lost-found'];

exports.listListings = async (req, res) => {
  try {
    const requested = String(req.query.type ?? 'all');
    if (requested !== 'all' && !LISTING_TYPES.includes(requested)) {
      return res.status(400).json({ error: 'Invalid listing type.' });
    }

    const queries = [];

    if (requested === 'all' || requested === 'marketplace') {
      queries.push(
        db.query(
          `SELECT
             m.m_item_id AS id,
             'marketplace' AS type,
             m.item_name AS title,
             m.description,
             m.status,
             m.price,
             m.\`condition\` AS item_condition,
             NULL AS post_type,
             m.image_url,
             m.created_at,
             c.category_name,
             cp.campus_code,
             cp.campus_name,
             u.user_id AS owner_id,
             u.full_name AS owner_name,
             u.email AS owner_email
           FROM m_items m
           JOIN categories c ON c.category_id = m.category_id
           JOIN campuses cp ON cp.campus_id = m.campus_id
           JOIN users u ON u.user_id = m.seller_id`
        )
      );
    }

    if (requested === 'all' || requested === 'lost-found') {
      queries.push(
        db.query(
          `SELECT
             i.lf_item_id AS id,
             'lost-found' AS type,
             i.item_name AS title,
             i.description,
             i.status,
             NULL AS price,
             NULL AS item_condition,
             i.post_type,
             i.image_url,
             i.created_at,
             c.category_name,
             cp.campus_code,
             cp.campus_name,
             u.user_id AS owner_id,
             u.full_name AS owner_name,
             u.email AS owner_email
           FROM lf_items i
           JOIN categories c ON c.category_id = i.category_id
           JOIN campuses cp ON cp.campus_id = i.campus_id
           JOIN users u ON u.user_id = i.user_id`
        )
      );
    }

    const results = await Promise.all(queries);
    const listings = results
      .flatMap(([rows]) => rows)
      .map((row) => ({ ...row, price: row.price === null ? null : Number(row.price) }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ listings });
  } catch (error) {
    console.error('listListings error:', error);
    return res.status(500).json({ error: 'Failed to load listings.' });
  }
};

exports.removeListing = async (req, res) => {
  const { type } = req.params;
  const listingId = Number(req.params.id);

  if (!LISTING_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid listing type.' });
  }
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (type === 'marketplace') {
      const [[item]] = await conn.query(
        'SELECT m_item_id, status FROM m_items WHERE m_item_id = ? FOR UPDATE',
        [listingId]
      );
      if (!item) {
        await conn.rollback();
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (item.status === 'Removed') {
        await conn.rollback();
        return res.status(409).json({ error: 'This listing has already been removed.' });
      }
      await conn.query("UPDATE m_items SET status = 'Removed' WHERE m_item_id = ?", [listingId]);
      await conn.query(
        "UPDATE buy_requests SET status = 'Declined' WHERE m_item_id = ? AND status = 'Pending'",
        [listingId]
      );
    } else {
      const [[item]] = await conn.query(
        'SELECT lf_item_id, status FROM lf_items WHERE lf_item_id = ? FOR UPDATE',
        [listingId]
      );
      if (!item) {
        await conn.rollback();
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (item.status === 'Removed') {
        await conn.rollback();
        return res.status(409).json({ error: 'This listing has already been removed.' });
      }
      await conn.query("UPDATE lf_items SET status = 'Removed' WHERE lf_item_id = ?", [listingId]);
      await conn.query(
        "UPDATE item_claims SET status = 'Declined', note = COALESCE(note, 'Post removed by administrator') WHERE lf_item_id = ? AND status IN ('Pending', 'Ready for return')",
        [listingId]
      );
    }

    await conn.commit();
    return res.json({ success: true, type, id: listingId, status: 'Removed' });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
    }
    console.error('removeListing error:', error);
    return res.status(500).json({ error: 'Failed to remove listing.' });
  } finally {
    conn.release();
  }
};
