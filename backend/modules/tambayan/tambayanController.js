const db = require('../../config/db');

const DAY_START = '07:30:00';
const DAY_END = '21:00:00';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizeHms(timeStr) {
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
}

function formatTime12(hms) {
  const [hStr, mStr] = String(hms).split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad2(m)} ${period}`;
}

function resolveQueryWindow(query) {
  const now = new Date();
  const rawDay = query.day ? String(query.day).trim() : '';
  const rawTime = query.time ? String(query.time).trim() : '';

  if (rawDay && !WEEKDAYS.includes(rawDay)) {
    return { error: 'Invalid day of the week.' };
  }
  if (rawTime && !TIME_RE.test(rawTime)) {
    return { error: 'Invalid time format.' };
  }

  const isCustom = Boolean(rawDay || rawTime);
  const dayOfWeek = rawDay || WEEKDAYS[now.getDay()];
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const dateLabel = rawDay ? rawDay : `${monthDay}, ${dayOfWeek}`;

  const currentHms = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const targetHms = rawTime ? normalizeHms(rawTime) : currentHms;
  const timeLabel = rawTime
    ? formatTime12(targetHms)
    : now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return {
    dayOfWeek,
    dateLabel,
    timeLabel,
    targetHms,
    isCustom
  };
}

function computeAvailableSlots(schedules) {
  const slots = [];
  let cursor = DAY_START;

  for (const s of schedules) {
    if (s.start_time > cursor) {
      slots.push(`${formatTime12(cursor)} – ${formatTime12(s.start_time)}`);
    }
    if (s.end_time > cursor) {
      cursor = s.end_time;
    }
  }

  if (cursor < DAY_END) {
    slots.push(`${formatTime12(cursor)} – ${formatTime12(DAY_END)}`);
  }

  return slots;
}

exports.getVacantRooms = async (req, res) => {
  try {
    const windowInfo = resolveQueryWindow(req.query);
    if (windowInfo.error) {
      return res.status(400).json({ error: windowInfo.error });
    }

    const { campus_id, building_id } = req.query;

    const [campuses] = await db.query(
      'SELECT campus_id, campus_code, campus_name FROM campuses ORDER BY campus_id ASC'
    );
    const [buildings] = await db.query(
      'SELECT building_id, campus_id, building_code, building_name, image_url FROM buildings ORDER BY building_id ASC'
    );

    const where = [
      'EXISTS (SELECT 1 FROM class_schedules cs WHERE cs.room_id = r.room_id)'
    ];
    const params = [];
    if (campus_id && campus_id !== 'All') {
      where.push('b.campus_id = ?');
      params.push(Number(campus_id));
    }
    if (building_id && building_id !== 'All') {
      where.push('r.building_id = ?');
      params.push(Number(building_id));
    }

    const [rooms] = await db.query(
      `SELECT
         r.room_id,
         r.room_code,
         b.building_id,
         b.building_code,
         b.building_name,
         b.image_url,
         c.campus_id,
         c.campus_code,
         c.campus_name
       FROM rooms r
       JOIN buildings b ON r.building_id = b.building_id
       JOIN campuses c ON b.campus_id = c.campus_id
       WHERE ${where.join(' AND ')}
       ORDER BY b.building_code ASC, r.room_code ASC`,
      params
    );

    const [schedules] = await db.query(
      `SELECT schedule_id, room_id, start_time, end_time
       FROM class_schedules
       WHERE day_of_week = ?
       ORDER BY start_time ASC`,
      [windowInfo.dayOfWeek]
    );

    const schedulesByRoom = new Map();
    for (const s of schedules) {
      if (!schedulesByRoom.has(s.room_id)) {
        schedulesByRoom.set(s.room_id, []);
      }
      schedulesByRoom.get(s.room_id).push(s);
    }

    const { targetHms } = windowInfo;
    const isOutsideClassHours = !(targetHms >= DAY_START && targetHms < DAY_END);
    const vacantRooms = [];

    if (!isOutsideClassHours) {
      for (const room of rooms) {
        const roomSchedules = schedulesByRoom.get(room.room_id) || [];
        const activeClass = roomSchedules.find(
          (s) => s.start_time <= targetHms && targetHms < s.end_time
        );

        if (activeClass) {
          continue;
        }

        let vacantFrom = DAY_START;
        let vacantUntil = DAY_END;

        for (const s of roomSchedules) {
          if (s.end_time <= targetHms && s.end_time > vacantFrom) {
            vacantFrom = s.end_time;
          }
          if (s.start_time > targetHms && s.start_time < vacantUntil) {
            vacantUntil = s.start_time;
          }
        }

        vacantRooms.push({
          ...room,
          vacantFrom: formatTime12(vacantFrom),
          vacantUntil: formatTime12(vacantUntil),
          availableSlots: computeAvailableSlots(roomSchedules)
        });
      }
    }

    return res.json({
      serverTime: {
        dayOfWeek: windowInfo.dayOfWeek,
        dateLabel: windowInfo.dateLabel,
        timeLabel: windowInfo.timeLabel,
        isCustom: windowInfo.isCustom,
        isOutsideClassHours
      },
      campuses,
      buildings,
      rooms: vacantRooms
    });
  } catch (error) {
    console.error('Tambayan getVacantRooms error:', error);
    return res.status(500).json({ error: 'Failed to load vacant rooms.' });
  }
};
