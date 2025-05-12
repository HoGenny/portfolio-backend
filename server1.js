require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const multer = require('multer');
const cors = require('cors');
const AWS = require('aws-sdk');

// HTML 템플릿 생성 유틸리티
const { generateHtmlByTemplate } = require('./utils/htmlGenerator');
// Mongoose 모델
const Portfolio = require('./models/Portfolio');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// AWS S3 설정
const s3 = new AWS.S3({
  region: process.env.AWS_REGION
});

// MongoDB 연결 (URI는 .env에 설정)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB 연결 성공!'))
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// 미들웨어 설정
app.use(cors());                    // CORS 허용
app.use(express.json());            // JSON 요청 본문 파싱
app.use(express.static('public'));  // 정적 파일 서빙

// ============================
// 헬스체크 라우트
// ============================
app.get('/', (req, res) => {
  res.send('CMS 서버가 실행 중입니다!');
});

// ============================
// 헬퍼 함수
// ============================

/**
 * S3에 HTML 파일 업로드
 * @param {string} filename S3에 저장할 파일명
 * @param {string} htmlContent 업로드할 HTML 문자열
 * @returns {Promise<string>} 업로드된 파일의 URL
 */
async function uploadToS3(filename, htmlContent) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `portfolios/${filename}`,
    Body: htmlContent,
    ContentType: 'text/html; charset=utf-8'
  };

  await s3.putObject(params).promise();
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/portfolios/${filename}`;
}

/**
 * 로컬 HTML 파일에서 썸네일(og:image 또는 첫 번째 <img>) 추출
 * @param {string} filePath 로컬 파일 경로
 * @returns {string|null} 추출된 썸네일 URL 또는 null
 */
function extractThumbnail(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) return ogImage;
    return $('img').first().attr('src') || null;
  } catch (err) {
    console.error(`썸네일 추출 실패 (${filePath}):`, err);
    return null;
  }
}

// ============================
// Multer 설정 (프로필 이미지 업로드)
// ============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename:  (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// ============================
// 포트폴리오 생성/관리 API
// ============================

/**
 * 포트폴리오 저장
 * 요청 바디: { template, username, name, bio, skills, projects, email, ... }
 */
app.post('/api/portfolios', async (req, res) => {
  const { template = 'template1.html', username, name, bio, skills, projects, email } = req.body;

  // 필수 입력 검증
  if (!username || !name || !bio || !skills || !projects || !email) {
    return res.status(400).json({ message: '필수 입력값이 부족합니다.' });
  }

  try {
    // HTML 템플릿 생성
    const htmlContent = generateHtmlByTemplate(template, req.body);
    const timestamp = Date.now();
    const safeName = name.replace(/\s+/g, '_');
    const filename = `${timestamp}_${safeName}.html`;

    // S3에 업로드
    const s3Url = await uploadToS3(filename, htmlContent);

    // MongoDB에 메타데이터 저장
    const newPortfolio = new Portfolio({
      username,
      filename,
      title: name,
      bio,
      url: s3Url
    });
    await newPortfolio.save();

    return res.json({ message: '포트폴리오 생성 완료!', link: s3Url });
  } catch (err) {
    console.error('포트폴리오 저장 오류:', err);
    return res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * 특정 사용자 포트폴리오 목록 조회 (썸네일 포함)
 * 쿼리 파라미터: ?user=username
 */
app.get('/api/portfolios', async (req, res) => {
  const { user } = req.query;
  if (!user) {
    return res.status(400).json({ message: 'user 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const results = await Portfolio.find({ username: user }).sort({ createdAt: -1 });

    const list = results.map(p => {
      const localPath = path.join(__dirname, 'public/portfolios', p.filename);
      const thumbnail = extractThumbnail(localPath) || '/static/images/default-thumbnail.png';
      return {
        filename:  p.filename,
        title:     p.title,
        bio:       p.bio,
        url:       p.url,
        thumbnail
      };
    });

    res.json(list);
  } catch (err) {
    console.error('포트폴리오 목록 조회 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 포트폴리오 HTML 직접 조회
 */
app.get('/api/portfolios/:filename', async (req, res) => {
  const { filename } = req.params;
  const params = { Bucket: process.env.S3_BUCKET_NAME, Key: `portfolios/${filename}` };

  try {
    const data = await s3.getObject(params).promise();
    res.set('Content-Type', 'text/html');
    res.send(data.Body.toString('utf-8'));
  } catch (err) {
    console.error('포트폴리오 로딩 실패:', err);
    res.status(404).json({ message: '파일을 찾을 수 없습니다.' });
  }
});

/**
 * 포트폴리오 수정
 * 요청 바디: { html }
 */
app.put('/api/portfolios/:filename', async (req, res) => {
  const { filename } = req.params;
  const { html } = req.body;

  if (!html) {
    return res.status(400).json({ message: '수정할 내용이 없습니다.' });
  }

  const params = {
    Bucket:      process.env.S3_BUCKET_NAME,
    Key:         `portfolios/${filename}`,
    Body:        html,
    ContentType: 'text/html; charset=utf-8'
  };

  try {
    await s3.putObject(params).promise();
    res.json({ message: '포트폴리오가 성공적으로 수정되었습니다.' });
  } catch (err) {
    console.error('S3 파일 수정 오류:', err);
    res.status(500).json({ message: '파일 저장 중 오류 발생' });
  }
});

/**
 * 포트폴리오 삭제
 */
app.delete('/api/portfolios/:filename', async (req, res) => {
  const { filename } = req.params;
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key:    `portfolios/${filename}`
  };

  try {
    // S3에서 삭제
    await s3.deleteObject(params).promise();
    // MongoDB에서 삭제
    await Portfolio.deleteOne({ filename });
    res.json({ message: '포트폴리오가 삭제되었습니다.' });
  } catch (err) {
    console.error('포트폴리오 삭제 실패:', err);
    res.status(500).json({ message: 'S3 또는 DB 삭제 중 오류 발생' });
  }
});

// ============================
// 사용자 회원가입/로그인 API
// ============================

/**
 * 회원가입
 * 요청 바디: { username, password, realname, birthdate }
 */
app.post('/users/signup', async (req, res) => {
  const { username, password, realname, birthdate } = req.body;

  // 입력 검증
  if (!username || !password || !realname || !birthdate) {
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: '비밀번호는 8자 이상이며 대소문자 및 숫자를 포함해야 합니다.' });
  }

  try {
    // 아이디 중복 검사
    if (await User.findOne({ username })) {
      return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
    }

    // 저장
    const newUser = new User({ username, password, realname, birthdate });
    await newUser.save();

    res.status(201).json({ message: '회원가입이 완료되었습니다.', userId: newUser._id });
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * 로그인
 * 요청 바디: { username, password }
 */
app.post('/users/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 로그인 성공
    res.json({ message: '로그인 성공', user: { username: user.username, realname: user.realname, birthdate: user.birthdate } });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// ============================
// 사용자 프로필 업데이트 API
// ============================

/**
 * 프로필 정보 수정
 * 요청 바디: { realname, bio, profilePic }
 */
app.put('/api/users/:username', async (req, res) => {
  const { username } = req.params;
  const { realname, bio, profilePic } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    user.realname   = realname   || user.realname;
    user.bio        = bio        || user.bio;
    user.profilePic = profilePic || user.profilePic;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error('프로필 수정 오류:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ============================
// 프로필 이미지 업로드 라우터
// ============================
app.post('/upload-profile', upload.single('profilePic'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ message: '업로드 성공', url: fileUrl });
});

// ============================
// 서버 시작
// ============================
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
