const { APP_CONFIG } = require('./config/app');

App({
  globalData: {
    appConfig: APP_CONFIG,
    bootAt: Date.now()
  }
});
