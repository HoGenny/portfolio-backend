const fs = require('fs');
const path = require('path');

function generateHtmlByTemplate(templateName, data) {
  // 템플릿 HTML 파일 경로
  const templatePath = path.join(__dirname, 'templates', templateName);

  // 기본 HTML이 없다면 fallback
  if (!fs.existsSync(templatePath)) {
    return fallbackHtml(data);
  }

  let template = fs.readFileSync(templatePath, 'utf-8');

  // 간단한 문자열 치환 방식 (템플릿에 {{변수명}} 형태로 자리 확보 필요)
  template = template.replace(/{{name}}/g, data.name)
                     .replace(/{{bio}}/g, data.bio)
                     .replace(/{{email}}/g, data.email)
                     .replace(/{{github}}/g, data.github || '')
                     .replace(/{{blog}}/g, data.blog || '')
                     .replace(/{{message}}/g, data.message || '')
                     .replace(/{{skills}}/g, data.skills.map(s => `<li>${s}</li>`).join('\n'))
                     .replace(/{{projects}}/g, data.projects.map(p => `<li>${p}</li>`).join('\n'))
                     .replace(/{{quests}}/g, data.quests.map(q => `<li>${q}</li>`).join('\n'));

  return template;
}

function fallbackHtml(data) {
  return `<html><body><h1>${data.name}</h1><p>${data.bio}</p></body></html>`;
}

module.exports = generateHtmlByTemplate;
