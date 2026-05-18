const mongoose = require('mongoose');

let connected = false;

async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    connected = true;
    return mongoose.connection;
  }
  if (connected) return mongoose.connection;
  mongoose.set('strictQuery', true);
  const { env } = require('../config');
  const uri = process.env.MONGODB_URI || env.MONGODB_URI;
  await mongoose.connect(uri, {
    autoIndex: env.NODE_ENV !== 'production',
  });
  connected = true;
  return mongoose.connection;
}

async function disconnectMongo() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

module.exports = { connectMongo, disconnectMongo };
