const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./db');
const ical = require('node-ical');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'covoitsecret';
const ICS_URL = 'https://api.ecoledirecte.com/v3/ical/E/4846/5532787a635456594d464230523264596132567757475534616c4a43526e5269656b465764307033.ics';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authMiddleware = (req, res, next) => {
  if (req.cookies.auth === APP_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

let icsCache = { timestamp: 0, events: [] };

async function getSchoolEvents(startDateStr, endDateStr) {
    const now = Date.now();
    if (now - icsCache.timestamp > 1000 * 60 * 60) {
        try {
            const data = await ical.async.fromURL(ICS_URL);
            icsCache.events = Object.values(data).filter(ev => ev.type === 'VEVENT');
            icsCache.timestamp = now;
        } catch (err) {
            console.error("Error fetching ICS:", err);
        }
    }

    const startDt = new Date(startDateStr);
    const endDt = new Date(endDateStr);
    endDt.setHours(23, 59, 59, 999);

    const eventsMap = {}; 

    const formatTime = (d) => d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const formatDate = (d) => {
        const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
        const map = {}; p.forEach(x => map[x.type] = x.value);
        return `${map.year}-${map.month}-${map.day}`;
    };

    icsCache.events.forEach(ev => {
        if (!ev.start || !ev.end) return;
        
        // Exclure les cours annulés (avec ou sans accent)
        const desc = (ev.description || '').toLowerCase();
        const sum = (ev.summary || '').toLowerCase();
        if (desc.includes('annulé') || sum.includes('annulé') || 
            desc.includes('annule') || sum.includes('annule')) return;

        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end);
        
        if (evStart >= startDt && evStart <= endDt) {
            const dateStr = formatDate(evStart);
            if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
            eventsMap[dateStr].push({
                start: formatTime(evStart),
                end: formatTime(evEnd),
                summary: ev.summary
            });
        }
    });
    return eventsMap;
}


app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.cookie('auth', password, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ success: true });
});

app.get('/api/week', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;
  const sql = `SELECT * FROM schedule WHERE date >= ? AND date <= ?`;
  
  try {
    const schoolEvents = await getSchoolEvents(startDate, endDate);
    
    db.all(sql, [startDate, endDate], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const scheduleMap = {};
      rows.forEach(row => {
        let mPass = {};
        try { const p = JSON.parse(row.morning_passengers); if (p && !Array.isArray(p)) mPass = p; } catch(e){}
        let ePass = {};
        try { const p = JSON.parse(row.evening_passengers); if (p && !Array.isArray(p)) ePass = p; } catch(e){}

        scheduleMap[row.date] = { 
          morning: { time: row.morning_time, passengers: mPass },
          evening: { time: row.evening_time, passengers: ePass }
        };
      });

      res.json({ schedule: scheduleMap, schoolEvents });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update', authMiddleware, (req, res) => {
  const { date, type, driver, passengers, time } = req.body;
  if (!['morning', 'evening'].includes(type)) return res.status(400).json({error: 'Invalid type'});

  const driverCol = `${type}_driver`;
  const passCol = `${type}_passengers`;
  const timeCol = `${type}_time`;
  const passStr = JSON.stringify(passengers || []);

  const sqlSelect = `SELECT * FROM schedule WHERE date = ?`;
  db.get(sqlSelect, [date], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      const sqlUpdate = `UPDATE schedule SET ${driverCol} = ?, ${passCol} = ?, ${timeCol} = ? WHERE date = ?`;
      db.run(sqlUpdate, [driver, passStr, time, date], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true });
      });
    } else {
      const isMorning = type === 'morning';
      const mDriver = isMorning ? driver : null;
      const mPass = isMorning ? passStr : '[]';
      const mTime = isMorning ? time : null;
      const eDriver = !isMorning ? driver : null;
      const ePass = !isMorning ? passStr : '[]';
      const eTime = !isMorning ? time : null;
      
      const sqlInsert = `INSERT INTO schedule (date, morning_driver, morning_passengers, morning_time, evening_driver, evening_passengers, evening_time) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sqlInsert, [date, mDriver, mPass, mTime, eDriver, ePass, eTime], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true });
      });
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
