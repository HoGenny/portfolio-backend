const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  username: { type: String, required: true }, // 소유자
  filename: { type: String, required: true }, // 실제 저장된 파일명
  title:String,     // 보여줄 제목 (예: 이름)
  bio: String,      // 한 줄 소개
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Portfolio', portfolioSchema);