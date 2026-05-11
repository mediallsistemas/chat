module.exports = {
  apps: [
    {
      name: 'mediall-backend',
      script: 'C:\\Users\\rafael.araujo\\projects\\mediall\\start-backend.bat',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'mediall-frontend',
      script: 'C:\\Users\\rafael.araujo\\projects\\mediall\\start-frontend.bat',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'development' },
    },
  ],
}
