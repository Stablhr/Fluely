// Fetch the MongoDB test binary once, before Jest starts its workers. Without
// this, two workers on a fresh CI machine download it at the same time and one
// fails on the download lock ("Cannot unlock file ... .lock").
const {MongoBinary} = require('mongodb-memory-server-core');

module.exports = async () => {
  await MongoBinary.getPath();
};
