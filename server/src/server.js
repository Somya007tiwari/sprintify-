const http = require('http');
const app = require('./app');
const { initSocket } = require('./realtime/socket');
const { startDueRemindersJob } = require('./jobs/dueReminders');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Sprintify Server & Socket.io running on http://localhost:${PORT}`);
  startDueRemindersJob();
});
