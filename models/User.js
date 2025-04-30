const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },  // 아이디
  password: { type: String, required: true },
  realname: { type: String, required: true },
  birthdate: { type: Date, required: true },
  bio: { type: String, required: true },
  profilePic: { type: String, required: true }
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
