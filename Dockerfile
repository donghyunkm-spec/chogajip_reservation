# Playwright가 포함된 Node.js 이미지 사용
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 복사
COPY . .

# 포트 설정
EXPOSE 3000

# 서버 시작
CMD ["node", "server.js"]
