const db = require('../../config/db');
const { sendLostFoundClaimEmail } = require('../../utils/mailer');

const VALID_CLAIM_STATUSES = new Set([
  'Pending',
  'Ready for return',
  'Returned',
  'Declined'
]);

const BASE_ITEM_SELECT = `
  SELECT
    i.lf_item_id,
    i.user_id,
    i.category_id,
    c.category_name,
    i.campus_id,
    cp.campus_code,
    cp.campus_name,
    i.location,
    i.post_type,
    i.item_name,
    i.description,
    DATE_FORMAT(i.date_event, '%Y-%m-%d') AS date_event,
    i.image_url,
    i.status,
    i.created_at,
    u.full_name AS poster_name,
    u.email AS poster_email
  FROM lf_items i
  JOIN categories c ON c.category_id = i.category_id
  JOIN campuses cp ON cp.campus_id = i.campus_id
  JOIN users u ON u.user_id = i.user_id
`;

exports.getMeta = async (_req, res) => {
  try {
    const [categories] = await db.query(
      "SELECT category_id, category_name FROM categories WHERE module_type IN ('Lost_Found', 'Both') ORDER BY category_id ASC"
    );
    const [campuses] = await db.query(
      'SELECT campus_id, campus_code, campus_name FROM campuses ORDER BY campus_id ASC'
    );
    return res.json({ categories, campuses });
  } catch (error) {
    console.error('Error fetching lost-found meta:', error);
    return res.status(500).json({ error: 'Failed to load Lost & Found metadata.' });
  }
};

exports.getItems = async (req, res) => {
  try {
    const { search, type, campus, category } = req.query;
    const conditions = [
      "i.status = 'Active'",
      "u.account_status = 'Active'",
      "NOT EXISTS (SELECT 1 FROM item_claims cl WHERE cl.lf_item_id = i.lf_item_id AND cl.status IN ('Ready for return', 'Returned'))"
    ];
    const params = [];

    if (type && ['Lost', 'Found'].includes(type)) {
      conditions.push('i.post_type = ?');
      params.push(type);
    }
    if (campus && campus !== 'All') {
      conditions.push('(cp.campus_code = ? OR cp.campus_id = ?)');
      params.push(campus, campus);
    }
    if (category && category !== 'All Items') {
      conditions.push('(c.category_name = ? OR c.category_id = ?)');
      params.push(category, category);
    }
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      conditions.push('(i.item_name LIKE ? OR i.location LIKE ? OR c.category_name LIKE ? OR i.description LIKE ?)');
      params.push(like, like, like, like);
    }

    const sql = `${BASE_ITEM_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY i.created_at DESC, i.lf_item_id DESC`;
    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching lost-found items:', error);
    return res.status(500).json({ error: 'Failed to load Lost & Found items.' });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: 'Invalid item ID.' });
    }
    const [rows] = await db.query(
      `${BASE_ITEM_SELECT} WHERE i.lf_item_id = ? AND i.status <> 'Removed' AND u.account_status = 'Active'`,
      [itemId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching lost-found item:', error);
    return res.status(500).json({ error: 'Failed to load item details.' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const {
      post_type,
      item_name,
      category_id,
      campus_id,
      location,
      date_event,
      description
    } = req.body;

    if (!['Lost', 'Found'].includes(post_type)) {
      return res.status(400).json({ error: 'Report type must be Lost or Found.' });
    }
    if (!item_name || !item_name.trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }
    if (!category_id || !campus_id || !date_event) {
      return res.status(400).json({ error: 'Category, campus, and date are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date_event))) {
      return res.status(400).json({ error: 'Invalid event date format.' });
    }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (String(date_event) > today) {
      return res.status(400).json({ error: 'Event date cannot be in the future.' });
    }

    const [[cat]] = await db.query(
      "SELECT category_id FROM categories WHERE category_id = ? AND module_type IN ('Lost_Found', 'Both')",
      [Number(category_id)]
    );
    if (!cat) {
      return res.status(400).json({ error: 'Invalid Lost & Found category.' });
    }

    const [[camp]] = await db.query(
      'SELECT campus_id FROM campuses WHERE campus_id = ?',
      [Number(campus_id)]
    );
    if (!camp) {
      return res.status(400).json({ error: 'Invalid campus.' });
    }

    const imageUrl = req.file ? `/api/uploads/lost-found/${req.file.filename}` : null;

    const [result] = await db.query(
      `INSERT INTO lf_items
        (user_id, category_id, campus_id, location, post_type, item_name, description, date_event, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [
        req.user.user_id,
        Number(category_id),
        Number(campus_id),
        location ? location.trim() : null,
        post_type,
        item_name.trim(),
        description ? description.trim() : null,
        date_event,
        imageUrl
      ]
    );

    const [rows] = await db.query(`${BASE_ITEM_SELECT} WHERE i.lf_item_id = ?`, [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating lost-found item:', error);
    return res.status(500).json({ error: 'Failed to create Lost & Found post.' });
  }
};

exports.createClaim = async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: 'Invalid item ID.' });
    }

    const [[item]] = await db.query(
      `SELECT
        i.lf_item_id,
        i.user_id,
        i.post_type,
        i.item_name,
        i.image_url,
        i.location,
        DATE_FORMAT(i.date_event, '%Y-%m-%d') AS date_event,
        i.status,
        c.category_name,
        cp.campus_code,
        u.full_name AS poster_name,
        u.email AS poster_email
       FROM lf_items i
       JOIN categories c ON c.category_id = i.category_id
       JOIN campuses cp ON cp.campus_id = i.campus_id
       JOIN users u ON u.user_id = i.user_id
       WHERE i.lf_item_id = ?`,
      [itemId]
    );
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (item.status !== 'Active') {
      return res.status(400).json({ error: 'This item is no longer active.' });
    }
    if (item.user_id === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot submit a claim on your own post.' });
    }

    const [existing] = await db.query(
      "SELECT claim_id FROM item_claims WHERE lf_item_id = ? AND claimant_id = ? AND status IN ('Pending', 'Ready for return')",
      [itemId, req.user.user_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You already have an active claim for this item.' });
    }

    const [approved] = await db.query(
      "SELECT claim_id FROM item_claims WHERE lf_item_id = ? AND status = 'Ready for return'",
      [itemId]
    );
    if (approved.length > 0) {
      return res.status(409).json({ error: 'A return is already in progress for this item.' });
    }

    const [[declinedRow]] = await db.query(
      "SELECT COUNT(*) AS count FROM item_claims WHERE lf_item_id = ? AND claimant_id = ? AND status = 'Declined'",
      [itemId, req.user.user_id]
    );
    if (Number(declinedRow.count) >= 2) {
      return res.status(403).json({
        error: 'You have reached the maximum number of claim attempts for this item.'
      });
    }

    const claimType = item.post_type === 'Found' ? 'This is Mine' : 'I Found This';
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 255) : null;

    const [result] = await db.query(
      "INSERT INTO item_claims (lf_item_id, claimant_id, claim_type, status, note) VALUES (?, ?, ?, 'Pending', ?)",
      [itemId, req.user.user_id, claimType, note]
    );

    try {
      await sendLostFoundClaimEmail({
        toEmail: item.poster_email,
        posterName: item.poster_name,
        itemName: item.item_name,
        imageUrl: item.image_url,
        postType: item.post_type,
        categoryName: item.category_name,
        campusCode: item.campus_code,
        location: item.location,
        dateEvent: item.date_event,
        claimType,
        claimantName: req.user.full_name,
        claimantEmail: req.user.email,
        note
      });
    } catch (mailError) {
      console.error('Failed to send Lost & Found claim email:', mailError);
    }

    return res.status(201).json({
      claim_id: result.insertId,
      lf_item_id: itemId,
      claim_type: claimType,
      status: 'Pending',
      note
    });
  } catch (error) {
    console.error('Error creating claim:', error);
    return res.status(500).json({ error: 'Failed to submit claim.' });
  }
};

exports.getClaims = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [incoming] = await db.query(
      `SELECT
        cl.claim_id,
        cl.lf_item_id,
        cl.claimant_id,
        cl.claim_type,
        cl.status,
        cl.note,
        cl.claimed_at,
        i.item_name,
        i.post_type,
        i.location,
        i.image_url,
        i.status AS item_status,
        DATE_FORMAT(i.date_event, '%Y-%m-%d') AS date_event,
        c.category_name,
        cp.campus_code,
        u.full_name AS claimant_name,
        u.email AS claimant_email
      FROM item_claims cl
      JOIN lf_items i ON i.lf_item_id = cl.lf_item_id
      JOIN categories c ON c.category_id = i.category_id
      JOIN campuses cp ON cp.campus_id = i.campus_id
      JOIN users u ON u.user_id = cl.claimant_id
      WHERE i.user_id = ? AND i.status <> 'Removed' AND u.account_status = 'Active'
      ORDER BY cl.claimed_at DESC, cl.claim_id DESC`,
      [userId]
    );

    const [outgoing] = await db.query(
      `SELECT
        cl.claim_id,
        cl.lf_item_id,
        cl.claimant_id,
        cl.claim_type,
        cl.status,
        cl.note,
        cl.claimed_at,
        i.item_name,
        i.post_type,
        i.location,
        i.image_url,
        i.status AS item_status,
        DATE_FORMAT(i.date_event, '%Y-%m-%d') AS date_event,
        c.category_name,
        cp.campus_code,
        u.full_name AS poster_name,
        u.email AS poster_email
      FROM item_claims cl
      JOIN lf_items i ON i.lf_item_id = cl.lf_item_id
      JOIN categories c ON c.category_id = i.category_id
      JOIN campuses cp ON cp.campus_id = i.campus_id
      JOIN users u ON u.user_id = i.user_id
      WHERE cl.claimant_id = ? AND i.status <> 'Removed' AND u.account_status = 'Active'
      ORDER BY cl.claimed_at DESC, cl.claim_id DESC`,
      [userId]
    );

    return res.json({ incoming, outgoing });
  } catch (error) {
    console.error('Error fetching claims:', error);
    return res.status(500).json({ error: 'Failed to load claims.' });
  }
};

exports.updateClaimStatus = async (req, res) => {
  try {
    const claimId = Number(req.params.claimId);
    const { status, note } = req.body;

    if (!Number.isInteger(claimId) || claimId <= 0) {
      return res.status(400).json({ error: 'Invalid claim ID.' });
    }
    if (!VALID_CLAIM_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid claim status.' });
    }

    const [[claim]] = await db.query(
      `SELECT cl.claim_id, cl.lf_item_id, cl.status, i.user_id AS poster_id
       FROM item_claims cl
       JOIN lf_items i ON i.lf_item_id = cl.lf_item_id
       WHERE cl.claim_id = ?`,
      [claimId]
    );

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }
    if (claim.poster_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the post owner can update this claim.' });
    }
    if (claim.status === 'Returned' || claim.status === 'Declined') {
      return res.status(400).json({ error: 'This claim has already been finalized and cannot be updated.' });
    }
    const allowedTransitions = {
      Pending: new Set(['Ready for return', 'Declined']),
      'Ready for return': new Set(['Returned'])
    };
    if (!allowedTransitions[claim.status]?.has(status)) {
      return res.status(400).json({ error: `Cannot change claim status from ${claim.status} to ${status}.` });
    }

    if (note !== undefined) {
      await db.query(
        'UPDATE item_claims SET status = ?, note = ? WHERE claim_id = ?',
        [status, note ? String(note).trim().slice(0, 255) : null, claimId]
      );
    } else {
      await db.query('UPDATE item_claims SET status = ? WHERE claim_id = ?', [status, claimId]);
    }

    if (status === 'Ready for return' || status === 'Returned') {
      await db.query(
        "UPDATE item_claims SET status = 'Declined' WHERE lf_item_id = ? AND claim_id != ? AND status IN ('Pending', 'Ready for return')",
        [claim.lf_item_id, claimId]
      );
    }

    if (status === 'Returned') {
      await db.query("UPDATE lf_items SET status = 'Returned' WHERE lf_item_id = ?", [claim.lf_item_id]);
    }

    return res.json({ claim_id: claimId, lf_item_id: claim.lf_item_id, status });
  } catch (error) {
    console.error('Error updating claim status:', error);
    return res.status(500).json({ error: 'Failed to update claim status.' });
  }
};

exports.getMyItems = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        i.lf_item_id,
        i.user_id,
        i.category_id,
        c.category_name,
        i.campus_id,
        cp.campus_code,
        cp.campus_name,
        i.location,
        i.post_type,
        i.item_name,
        i.description,
        DATE_FORMAT(i.date_event, '%Y-%m-%d') AS date_event,
        i.image_url,
        i.status,
        i.created_at,
        (
          SELECT COUNT(*)
          FROM item_claims cl
          WHERE cl.lf_item_id = i.lf_item_id
            AND cl.status IN ('Pending', 'Ready for return')
        ) AS active_claim_count,
        EXISTS (
          SELECT 1
          FROM item_claims cl
          WHERE cl.lf_item_id = i.lf_item_id
            AND cl.status = 'Ready for return'
        ) AS has_approved_return
      FROM lf_items i
      JOIN categories c ON c.category_id = i.category_id
      JOIN campuses cp ON cp.campus_id = i.campus_id
      WHERE i.user_id = ? AND i.status != 'Removed'
      ORDER BY i.created_at DESC, i.lf_item_id DESC`,
      [req.user.user_id]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching user lost-found items:', error);
    return res.status(500).json({ error: 'Failed to load your posts.' });
  }
};

exports.markItemReturned = async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: 'Invalid item ID.' });
    }

    const [[item]] = await db.query(
      'SELECT lf_item_id, user_id, status FROM lf_items WHERE lf_item_id = ?',
      [itemId]
    );
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (item.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the post owner can mark this item as returned.' });
    }
    if (item.status === 'Returned') {
      return res.json({ lf_item_id: itemId, status: 'Returned' });
    }

    const [approved] = await db.query(
      "SELECT claim_id FROM item_claims WHERE lf_item_id = ? AND status = 'Ready for return'",
      [itemId]
    );
    if (approved.length > 0) {
      return res.status(409).json({
        error: 'This item has an approved return request. Please mark it as returned in View Requests.'
      });
    }

    await db.query(
      "UPDATE lf_items SET status = 'Returned' WHERE lf_item_id = ?",
      [itemId]
    );
    await db.query(
      "UPDATE item_claims SET status = 'Declined', note = COALESCE(note, 'Item returned externally') WHERE lf_item_id = ? AND status = 'Pending'",
      [itemId]
    );

    return res.json({ lf_item_id: itemId, status: 'Returned' });
  } catch (error) {
    console.error('Error marking item returned:', error);
    return res.status(500).json({ error: 'Failed to mark item as returned.' });
  }
};
