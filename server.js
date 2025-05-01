// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const multer = require('multer');
const cors = require('cors');
const AWS = require('aws-sdk');

// 모델 불러오기
const Portfolio = require('./models/Portfolio');

const app = express();
const PORT = process.env.PORT || 3000;
const s3 = new AWS.S3({
  region: process.env.AWS_REGION
});

// MongoDB 연결
mongoose.connect('mongodb+srv://tyui3024:Hojin9024%40@cluster0.uwdfwq5.mongodb.net/mycms?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB 연결 성공!'))
.catch(err => console.error('❌ MongoDB 연결 실패', err));

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 테스트 라우트
app.get('/', (req, res) => {
  res.send('CMS 서버가 실행 중입니다!');
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT} 에서 서버 실행 중`);
});

async function uploadToS3(filename, htmlContent) {
  console.log("🚨 uploadToS3 실행됨");

  // 그리고 여기에 변수 로그
  console.log("🚨 process.env.S3_BUCKET_NAME:", `"${process.env.S3_BUCKET_NAME}"`);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `portfolios/${filename}`,
    Body: htmlContent,
    ContentType: 'text/html',
    ACL: 'public-read' // 공개 URL로 접근 가능하게
  };

  await s3.putObject(params).promise();

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/portfolios/${filename}`;
}


// 포트폴리오 저장 API
app.post('/api/portfolios', async (req, res) => {
    try {
      const { username, name, bio, skills, projects, email, github, blog, message } = req.body;
      if (!name || !bio || !skills || !projects || !email) {
        return res.status(400).json({ message: '필수 입력값이 부족합니다.' });
      }
  
      const htmlContent = `<!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}의 포트폴리오</title>
    <style>
      :root {
        --bg-color: #ffffff;
        --text-color: #1e1e1e;
        --primary-blue: #3182f6;
        --light-blue: #eff6ff;
        --shadow: 0 8px 20px rgba(49, 130, 246, 0.1);
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; font-family: 'Segoe UI', sans-serif; background-color: var(--bg-color); color: var(--text-color); scroll-behavior: smooth; overflow-y: scroll; scroll-snap-type: y mandatory; }
      section { height: 100vh; width: 100vw; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; scroll-snap-align: start; opacity: 0; transform: translateY(60px); transition: opacity 0.8s ease, transform 0.8s ease; padding: 2rem; }
      section.visible { opacity: 1; transform: translateY(0); }
      .section-title { font-size: 2.2rem; font-weight: 700; color: var(--primary-blue); margin-bottom: 2rem; }
      .hero { background: linear-gradient(to right, #dbeafe, #eff6ff); box-shadow: var(--shadow); }
      .hero h1 { font-size: 3rem; color: var(--primary-blue); margin-bottom: 1rem; }
      .hero p { font-size: 1.3rem; color: #333; max-width: 600px; }
      .hero .scroll-icon { font-size: 2.5rem; margin-top: 2.5rem; animation: bounce 1.5s infinite; color: var(--primary-blue); }
      @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      .tags span, .skills div, .quests div { display: inline-block; background: var(--light-blue); padding: 0.6rem 1rem; margin: 0.5rem; border-radius: 999px; box-shadow: var(--shadow); }
      .timeline-item { text-align: left; border-left: 4px solid var(--primary-blue); padding-left: 1rem; background: #f9fafe; margin-bottom: 2rem; padding: 1rem; border-radius: 8px; box-shadow: var(--shadow); }
      .links a { display: inline-block; margin: 0.5rem 1rem; color: var(--primary-blue); text-decoration: none; font-weight: 500; font-size: 1.1rem; }
      .links a:hover { text-decoration: underline; }
      .footer { font-size: 1rem; color: #666; margin-top: 2rem; }
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>코드를 모험하다, ${name}입니다.</h1>
      <p>${bio}</p>
      <div class="scroll-icon">⬇️</div>
    </section>
  
    <section>
      <div class="section-title">개발자 DNA</div>
      <div class="tags">
        ${skills.map(s => `<span>${s}</span>`).join('')}
      </div>
    </section>
  
    <section>
      <div class="section-title">🚀 프로젝트 여정</div>
      <div class="section-content">
        ${projects.map(p => `<div class="timeline-item">${p}</div>`).join('')}
      </div>
    </section>
  
    <section>
      <div class="section-title">📬 나와 연결하기</div>
      <div class="links">
        <a href="mailto:${email}">이메일</a>
        ${github ? `<a href="${github}" target="_blank">GitHub</a>` : ""}
        ${blog ? `<a href="${blog}" target="_blank">블로그</a>` : ""}
      </div>
    </section>
  
    <section class="footer">
      <p>“${message}”</p>
    </section>
  
    <script>
      const sections = document.querySelectorAll("section");
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      }, { threshold: 0.2 });
      sections.forEach(section => observer.observe(section));
    </script>
  </body>
  </html>`;
  
      const timestamp = Date.now();
      const safeName = name.replace(/\s/g, '_');
      const filename = `${timestamp}_${safeName}.html`;
      const filePath = `public/portfolios/${filename}`;
  
      if (!fs.existsSync('public/portfolios')) {
        fs.mkdirSync('public/portfolios', { recursive: true });
      }
  
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
      
      res.json({ message: '포트폴리오가 생성되었습니다!', link: s3Url });
    } catch (err) {
      console.error('포트폴리오 저장 오류:', err);
      res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
  });
  

// 썸네일 자동 추출 + 목록 API
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

// GET /api/portfolios?user=username
app.get('/api/portfolios', async (req, res) => {
  const { user } = req.query;
  if (!user) return res.status(400).json({ message: 'user 쿼리 파라미터가 필요합니다.' });

  try {
    const results = await Portfolio.find({ username: user }).sort({ createdAt: -1 });

    // 썸네일 추출
    const mapped = results.map(p => {
      const fullPath = path.join(__dirname, 'public/portfolios', p.filename);
      const thumbnail = extractThumbnail(fullPath);
      return {
        filename: p.filename,
        title: p.title,
        bio: p.bio,
        thumbnail: thumbnail || '/static/images/default-thumbnail.png'
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('포트폴리오 목록 조회 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});


// 회원가입 API
const User = require('./models/User');

app.post('/users/signup', async (req, res) => {
  try {
    const { username, password, realname, birthdate } = req.body;

    // 필수값 검사
    if (!username || !password || !realname || !birthdate) {
      return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
    }

    // 비밀번호 정규식 검증
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: '비밀번호는 8자 이상이며 대소문자 및 숫자를 포함해야 합니다.'
      });
    }

    // 아이디 중복 확인
    const existingUser = await User.findOne({ username });
    if (existingUser) {
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

// 로그인 API
app.post('/users/login', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' });
      }
  
      const user = await User.findOne({ username });
  
      if (!user || user.password !== password) {
        return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }
  
      // 성공
      res.json({
        message: '로그인 성공',
        user: {
          username: user.username,
          realname: user.realname,
          birthdate: user.birthdate
        }
      });
    } catch (err) {
      console.error('로그인 오류:', err);
      res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
  });
  

// 포트폴리오 삭제 API
app.delete('/api/portfolios/:filename', (req, res) => {
  const { filename } = req.params;

  const filePath = path.join(__dirname, 'public/portfolios', filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('포트폴리오 삭제 실패:', err);
      return res.status(500).json({ message: '파일 삭제 중 오류 발생' });
    }

    res.json({ message: '포트폴리오가 삭제되었습니다.' });
  });
});

// 포트폴리오 내용 불러오기
app.get('/api/portfolios/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public/portfolios', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: '파일을 찾을 수 없습니다.' });
  }
  const html = fs.readFileSync(filePath, 'utf8');
  res.send(html); // HTML 그대로 반환
});

// 포트폴리오 내용 수정
app.put('/api/portfolios/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public/portfolios', req.params.filename);
  const { html } = req.body;

  if (!html) return res.status(400).json({ message: '수정할 내용이 없습니다.' });

  fs.writeFile(filePath, html, (err) => {
    if (err) {
      console.error('파일 저장 오류:', err);
      return res.status(500).json({ message: '파일 저장 중 오류 발생' });
    }
    res.json({ message: '포트폴리오가 성공적으로 수정되었습니다.' });
  });
});

// 사용자 프로필 업데이트 API
app.put('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    const { realname, bio, profilePic } = req.body;
  
    try {
      const user = await User.findOne({ username });
      if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  
      user.realname = realname || user.realname;
      user.bio = bio || user.bio;
      user.profilePic = profilePic || user.profilePic;
  
      await user.save();
      res.json(user);
    } catch (err) {
      console.error('프로필 수정 오류:', err);
      res.status(500).json({ message: '서버 오류' });
    }
  });

  // 이미지 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/uploads'); // 저장 폴더
    },
    filename: function (req, file, cb) {
      const uniqueName = Date.now() + '_' + file.originalname;
      cb(null, uniqueName);
    }
  });
const upload = multer({ storage });
  
// 이미지 업로드 라우터
app.post('/upload-profile', upload.single('profilePic'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
  
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ message: '업로드 성공', url: fileUrl });
  });