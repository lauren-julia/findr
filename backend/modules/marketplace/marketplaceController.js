const fs = require('fs');
const db = require('../../config/db');
const { sendMarketplaceRequestEmail } = require('../../utils/mailer');

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const REQUEST_STATUSES = new Set(['Confirmed', 'Declined', 'Cancelled']);

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_PRICE = 99999999.99;
const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 48;
const DUPLICATE_WINDOW_SECONDS = 15;

const ITEM_COLUMNS = `
  m.m_item_id,
  m.seller_id,
  m.category_id,
  c.category_name,
  m.campus_id,
  cp.campus_code,
  cp.campus_name,
  m.item_name,
  m.description,
  m.price,
  m.\`condition\`,
  m.image_url,
  m.status,
  m.created_at
`;

const ITEM_FROM = `
  FROM m_items m
  JOIN categories c ON c.category_id = m.category_id
  JOIN campuses cp ON cp.campus_id = m.campus_id
  JOIN users u ON u.user_id = m.seller_id
`;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function formatItem(row) {
  return { ...row, price: Number(row.price) };
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMoney(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  const amount = Number(text);
  return amount <= MAX_PRICE ? amount : NaN;
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

function discardFile(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

async function withTransaction(work) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
    }
    throw error;
  } finally {
    conn.release();
  }
}

function respondWithError(res, error, logLabel, fallbackMessage) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`${logLabel}:`, error);
  return res.status(500).json({ error: fallbackMessage });
}

exports.ensureMarketplaceTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS m_items (
        m_item_id   INT AUTO_INCREMENT PRIMARY KEY,
        seller_id   INT NOT NULL,
        category_id INT NOT NULL,
        campus_id   INT NOT NULL,
        item_name   VARCHAR(100) NOT NULL,
        description TEXT NULL,
        price       DECIMAL(10,2) NOT NULL,
        \`condition\` ENUM('New', 'Like New', 'Good', 'Fair') NOT NULL,
        image_url   VARCHAR(255) NOT NULL,
        status      ENUM('Available', 'Sold', 'Removed') NOT NULL DEFAULT 'Available',
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_m_items_seller   FOREIGN KEY (seller_id)   REFERENCES users (user_id),
        CONSTRAINT fk_m_items_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
        CONSTRAINT fk_m_items_campus   FOREIGN KEY (campus_id)   REFERENCES campuses (campus_id)
      ) ENGINE=InnoDB
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS buy_requests (
        request_id   INT AUTO_INCREMENT PRIMARY KEY,
        m_item_id    INT NOT NULL,
        buyer_id     INT NOT NULL,
        status       ENUM('Pending', 'Confirmed', 'Declined', 'Cancelled') NOT NULL DEFAULT 'Pending',
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_buy_requests_item  FOREIGN KEY (m_item_id) REFERENCES m_items (m_item_id),
        CONSTRAINT fk_buy_requests_buyer FOREIGN KEY (buyer_id)  REFERENCES users (user_id)
      ) ENGINE=InnoDB
    `);
  } catch (error) {
    console.warn('Marketplace schema check skipped:', error.message || error.code || error);
  }
};

exports.getMeta = async (_req, res) => {
  try {
    const [categories] = await db.query(
      "SELECT category_id, category_name FROM categories WHERE module_type IN ('Marketplace', 'Both') ORDER BY category_id ASC"
    );
    const [campuses] = await db.query(
      'SELECT campus_id, campus_code, campus_name FROM campuses ORDER BY campus_id ASC'
    );
    return res.json({ categories, campuses, conditions: CONDITIONS });
  } catch (error) {
    console.error('Error fetching marketplace meta:', error);
    return res.status(500).json({ error: 'Failed to load Marketplace metadata.' });
  }
};

exports.getItems = async (req, res) => {
  try {
    const { search, category, campus, condition, minPrice, maxPrice } = req.query;
    const conditions = ["m.status = 'Available'", "u.account_status = 'Active'"];
    const params = [];

    if (req.user?.user_id) {
      conditions.push('m.seller_id <> ?');
      params.push(req.user.user_id);
    }

    if (condition !== undefined && condition !== '' && condition !== 'All') {
      if (!CONDITIONS.includes(condition)) {
        return res.status(400).json({ error: 'Invalid condition filter.' });
      }
      conditions.push('m.`condition` = ?');
      params.push(condition);
    }

    if (campus && campus !== 'All') {
      if (/^\d+$/.test(String(campus))) {
        conditions.push('cp.campus_id = ?');
        params.push(Number(campus));
      } else {
        conditions.push('cp.campus_code = ?');
        params.push(String(campus));
      }
    }

    if (category && category !== 'All Items') {
      if (/^\d+$/.test(String(category))) {
        conditions.push('c.category_id = ?');
        params.push(Number(category));
      } else {
        conditions.push('c.category_name = ?');
        params.push(String(category));
      }
    }

    let min = null;
    let max = null;
    if (minPrice !== undefined && minPrice !== '') {
      min = parseMoney(minPrice);
      if (Number.isNaN(min)) {
        return res.status(400).json({ error: 'Minimum price must be a valid amount of 0 or more.' });
      }
      conditions.push('m.price >= ?');
      params.push(min);
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      max = parseMoney(maxPrice);
      if (Number.isNaN(max)) {
        return res.status(400).json({ error: 'Maximum price must be a valid amount of 0 or more.' });
      }
      conditions.push('m.price <= ?');
      params.push(max);
    }
    if (min !== null && max !== null && min > max) {
      return res.status(400).json({ error: 'Minimum price cannot be higher than maximum price.' });
    }

    const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    if (term) {
      const like = `%${escapeLike(term)}%`;
      conditions.push('(m.item_name LIKE ? OR m.description LIKE ? OR c.category_name LIKE ?)');
      params.push(like, like, like);
    }

    const limit = Math.min(parsePositiveInt(req.query.limit) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const requestedPage = parsePositiveInt(req.query.page) || 1;
    const where = conditions.join(' AND ');

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total ${ITEM_FROM} WHERE ${where}`,
      params
    );
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);

    const [rows] = await db.query(
      `SELECT ${ITEM_COLUMNS} ${ITEM_FROM}
       WHERE ${where}
       ORDER BY m.created_at DESC, m.m_item_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );

    return res.json({
      items: rows.map(formatItem),
      total: Number(total),
      page,
      limit,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching marketplace items:', error);
    return res.status(500).json({ error: 'Failed to load marketplace listings.' });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const itemId = parsePositiveInt(req.params.id);
    if (!itemId) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }
    const [rows] = await db.query(
      `SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE m.m_item_id = ? AND m.status <> 'Removed' AND u.account_status = 'Active'`,
      [itemId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    return res.json(formatItem(rows[0]));
  } catch (error) {
    console.error('Error fetching marketplace item:', error);
    return res.status(500).json({ error: 'Failed to load listing details.' });
  }
};

exports.createItem = async (req, res) => {
  const reject = (status, message) => {
    discardFile(req.file);
    return res.status(status).json({ error: message });
  };

  let lockConn = null;
  let lockName = null;

  try {
    const body = req.body || {};
    const itemName = String(body.item_name ?? '').trim();
    const description = String(body.description ?? '').trim();
    const categoryId = parsePositiveInt(body.category_id);
    const campusId = parsePositiveInt(body.campus_id);
    const condition = String(body.condition ?? '').trim();
    const price = parseMoney(body.price);

    if (!itemName) return reject(400, 'Item name is required.');
    if (itemName.length > MAX_NAME_LENGTH) {
      return reject(400, `Item name must be ${MAX_NAME_LENGTH} characters or fewer.`);
    }
    if (!categoryId || !campusId) return reject(400, 'Category and campus are required.');
    if (!CONDITIONS.includes(condition)) return reject(400, 'Please select a valid item condition.');
    if (Number.isNaN(price)) {
      return reject(400, 'Price must be a valid amount of 0 or more (up to two decimal places).');
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return reject(400, `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
    }
    if (!req.file) return reject(400, 'A JPEG or PNG item photo is required.');

    const [[category]] = await db.query(
      "SELECT category_id FROM categories WHERE category_id = ? AND module_type IN ('Marketplace', 'Both')",
      [categoryId]
    );
    if (!category) return reject(400, 'Invalid Marketplace category.');

    const [[campus]] = await db.query('SELECT campus_id FROM campuses WHERE campus_id = ?', [campusId]);
    if (!campus) return reject(400, 'Invalid campus.');

    lockName = `findr-mk-create-${req.user.user_id}`;
    lockConn = await db.getConnection();
    const [[lockRow]] = await lockConn.query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
    if (Number(lockRow.acquired) !== 1) {
      return reject(409, 'Your previous submission is still being processed. Please try again.');
    }

    const [recent] = await lockConn.query(
      `SELECT m_item_id FROM m_items
       WHERE seller_id = ? AND item_name = ? AND price = ? AND category_id = ? AND campus_id = ?
         AND status <> 'Removed'
         AND created_at >= (NOW() - INTERVAL ${DUPLICATE_WINDOW_SECONDS} SECOND)
       ORDER BY m_item_id DESC LIMIT 1`,
      [req.user.user_id, itemName, price, categoryId, campusId]
    );

    let itemId;
    let created = true;
    if (recent.length > 0) {
      itemId = recent[0].m_item_id;
      created = false;
      discardFile(req.file);
    } else {
      const [result] = await lockConn.query(
        `INSERT INTO m_items
          (seller_id, category_id, campus_id, item_name, description, price, \`condition\`, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available')`,
        [
          req.user.user_id,
          categoryId,
          campusId,
          itemName,
          description || null,
          price,
          condition,
          `/api/uploads/marketplace/${req.file.filename}`
        ]
      );
      itemId = result.insertId;
    }

    const [rows] = await lockConn.query(
      `SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE m.m_item_id = ?`,
      [itemId]
    );
    return res.status(created ? 201 : 200).json(formatItem(rows[0]));
  } catch (error) {
    discardFile(req.file);
    console.error('Error creating marketplace listing:', error);
    return res.status(500).json({ error: 'Failed to create listing.' });
  } finally {
    if (lockConn) {
      try {
        await lockConn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch {
      }
      lockConn.release();
    }
  }
};

exports.getMyItems = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${ITEM_COLUMNS},
         (SELECT COUNT(*) FROM buy_requests br
           WHERE br.m_item_id = m.m_item_id AND br.status = 'Pending') AS pending_request_count
       ${ITEM_FROM}
       WHERE m.seller_id = ? AND m.status <> 'Removed'
       ORDER BY m.created_at DESC, m.m_item_id DESC`,
      [req.user.user_id]
    );
    return res.json(
      rows.map((row) => ({ ...formatItem(row), pending_request_count: Number(row.pending_request_count) }))
    );
  } catch (error) {
    console.error('Error fetching user marketplace items:', error);
    return res.status(500).json({ error: 'Failed to load your listings.' });
  }
};

exports.markItemSold = async (req, res) => {
  try {
    const itemId = parsePositiveInt(req.params.id);
    if (!itemId) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const result = await withTransaction(async (conn) => {
      const [[item]] = await conn.query(
        'SELECT m_item_id, seller_id, status FROM m_items WHERE m_item_id = ? FOR UPDATE',
        [itemId]
      );
      if (!item || item.status === 'Removed') {
        throw new HttpError(404, 'Listing not found.');
      }
      if (item.seller_id !== req.user.user_id) {
        throw new HttpError(403, 'Only the seller can mark this listing as sold.');
      }
      if (item.status === 'Sold') {
        return { m_item_id: itemId, status: 'Sold' };
      }

      await conn.query("UPDATE m_items SET status = 'Sold' WHERE m_item_id = ?", [itemId]);
      await conn.query(
        "UPDATE buy_requests SET status = 'Declined' WHERE m_item_id = ? AND status = 'Pending'",
        [itemId]
      );
      return { m_item_id: itemId, status: 'Sold' };
    });

    return res.json(result);
  } catch (error) {
    return respondWithError(res, error, 'Error marking listing sold', 'Failed to mark listing as sold.');
  }
};

exports.createRequest = async (req, res) => {
  try {
    const itemId = parsePositiveInt(req.params.id);
    if (!itemId) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const requestId = await withTransaction(async (conn) => {
      const [[item]] = await conn.query(
        'SELECT m_item_id, seller_id, status FROM m_items WHERE m_item_id = ? FOR UPDATE',
        [itemId]
      );
      if (!item || item.status === 'Removed') {
        throw new HttpError(404, 'Listing not found.');
      }
      if (item.status !== 'Available') {
        throw new HttpError(409, 'This item is no longer available.');
      }
      if (item.seller_id === req.user.user_id) {
        throw new HttpError(400, 'You cannot request to buy your own listing.');
      }

      const [existing] = await conn.query(
        "SELECT request_id FROM buy_requests WHERE m_item_id = ? AND buyer_id = ? AND status = 'Pending'",
        [itemId, req.user.user_id]
      );
      if (existing.length > 0) {
        throw new HttpError(409, 'You already have a pending request for this item.');
      }

      const [[declinedRow]] = await conn.query(
        "SELECT COUNT(*) AS count FROM buy_requests WHERE m_item_id = ? AND buyer_id = ? AND status = 'Declined'",
        [itemId, req.user.user_id]
      );
      if (Number(declinedRow.count) >= 2) {
        throw new HttpError(403, 'You have reached the maximum number of buy request attempts for this item.');
      }

      const [result] = await conn.query(
        "INSERT INTO buy_requests (m_item_id, buyer_id, status) VALUES (?, ?, 'Pending')",
        [itemId, req.user.user_id]
      );
      return result.insertId;
    });

    notifySellerOfRequest(itemId, req.user).catch((mailError) => {
      console.error('Failed to send Marketplace request email:', mailError);
    });

    return res.status(201).json({ request_id: requestId, m_item_id: itemId, status: 'Pending' });
  } catch (error) {
    return respondWithError(res, error, 'Error creating buy request', 'Failed to submit buy request.');
  }
};

async function notifySellerOfRequest(itemId, buyer) {
  const [[row]] = await db.query(
    `SELECT m.item_name, m.price, m.\`condition\`, m.image_url, c.category_name, cp.campus_code,
            u.full_name AS seller_name, u.email AS seller_email
     FROM m_items m
     JOIN categories c ON c.category_id = m.category_id
     JOIN campuses cp ON cp.campus_id = m.campus_id
     JOIN users u ON u.user_id = m.seller_id
     WHERE m.m_item_id = ?`,
    [itemId]
  );
  if (!row) return;

  await sendMarketplaceRequestEmail({
    toEmail: row.seller_email,
    sellerName: row.seller_name,
    itemName: row.item_name,
    price: row.price,
    condition: row.condition,
    imageUrl: row.image_url,
    categoryName: row.category_name,
    campusCode: row.campus_code,
    buyerName: buyer.full_name,
    buyerEmail: buyer.email
  });
}

const REQUEST_COLUMNS = `
  br.request_id,
  br.m_item_id,
  br.buyer_id,
  br.status,
  br.requested_at,
  m.seller_id,
  m.item_name,
  m.price,
  m.\`condition\`,
  m.image_url,
  m.created_at AS item_created_at,
  m.status AS item_status,
  c.category_name,
  cp.campus_code,
  cp.campus_name
`;

const REQUEST_FROM = `
  FROM buy_requests br
  JOIN m_items m ON m.m_item_id = br.m_item_id
  JOIN categories c ON c.category_id = m.category_id
  JOIN campuses cp ON cp.campus_id = m.campus_id
`;

function formatRequest(row) {
  return { ...row, price: Number(row.price) };
}

exports.getRequests = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [incoming] = await db.query(
      `SELECT ${REQUEST_COLUMNS},
              u.full_name AS buyer_name, u.email AS buyer_email
       ${REQUEST_FROM}
       JOIN users u ON u.user_id = br.buyer_id
       WHERE m.seller_id = ? AND m.status <> 'Removed' AND u.account_status = 'Active'
       ORDER BY br.requested_at DESC, br.request_id DESC`,
      [userId]
    );

    const [outgoing] = await db.query(
      `SELECT ${REQUEST_COLUMNS},
              u.full_name AS seller_name, u.email AS seller_email
       ${REQUEST_FROM}
       JOIN users u ON u.user_id = m.seller_id
       WHERE br.buyer_id = ? AND m.status <> 'Removed' AND u.account_status = 'Active'
       ORDER BY br.requested_at DESC, br.request_id DESC`,
      [userId]
    );

    return res.json({ incoming: incoming.map(formatRequest), outgoing: outgoing.map(formatRequest) });
  } catch (error) {
    console.error('Error fetching marketplace requests:', error);
    return res.status(500).json({ error: 'Failed to load requests.' });
  }
};

exports.updateRequestStatus = async (req, res) => {
  try {
    const requestId = parsePositiveInt(req.params.requestId);
    const status = req.body?.status;

    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }
    if (!REQUEST_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Status must be Confirmed, Declined, or Cancelled.' });
    }

    const result = await withTransaction(async (conn) => {
      const [[lookup]] = await conn.query(
        'SELECT m_item_id FROM buy_requests WHERE request_id = ?',
        [requestId]
      );
      if (!lookup) {
        throw new HttpError(404, 'Request not found.');
      }

      const [[item]] = await conn.query(
        'SELECT m_item_id, seller_id, status FROM m_items WHERE m_item_id = ? FOR UPDATE',
        [lookup.m_item_id]
      );
      const [[request]] = await conn.query(
        'SELECT request_id, m_item_id, buyer_id, status FROM buy_requests WHERE request_id = ? FOR UPDATE',
        [requestId]
      );
      if (!item || !request) {
        throw new HttpError(404, 'Request not found.');
      }

      const userId = req.user.user_id;

      if (status === 'Cancelled') {
        if (request.buyer_id !== userId) {
          throw new HttpError(403, 'Only the buyer can cancel this request.');
        }
      } else if (item.seller_id !== userId) {
        throw new HttpError(403, 'Only the seller can respond to this request.');
      }

      if (request.status !== 'Pending') {
        throw new HttpError(409, `This request is already ${request.status.toLowerCase()} and can no longer be changed.`);
      }

      if (status === 'Confirmed') {
        if (item.status !== 'Available') {
          throw new HttpError(409, 'This listing is no longer available.');
        }
        await conn.query("UPDATE buy_requests SET status = 'Confirmed' WHERE request_id = ?", [requestId]);
        await conn.query(
          "UPDATE buy_requests SET status = 'Declined' WHERE m_item_id = ? AND request_id <> ? AND status = 'Pending'",
          [item.m_item_id, requestId]
        );
        await conn.query("UPDATE m_items SET status = 'Sold' WHERE m_item_id = ?", [item.m_item_id]);
        return { request_id: requestId, m_item_id: item.m_item_id, status, item_status: 'Sold' };
      }

      await conn.query('UPDATE buy_requests SET status = ? WHERE request_id = ?', [status, requestId]);
      return { request_id: requestId, m_item_id: item.m_item_id, status, item_status: item.status };
    });

    return res.json(result);
  } catch (error) {
    return respondWithError(res, error, 'Error updating buy request', 'Failed to update request.');
  }
};
