const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },  // 아이디
  password: { type: String, required: true },
  realname: { type: String, required: true },
  birthdate: { type: Date, required: true },
  bio: { type: String, default: '' },
  profilePic: { type: String, default: '/static/images/default-profile.png' }
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
