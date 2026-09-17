import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'*.spec.js',fullyParallel:true,workers:2,use:{baseURL:'http://127.0.0.1:4190',headless:true,serviceWorkers:'block'},webServer:{command:'node dev.mjs',env:{PORT:'4190'},url:'http://127.0.0.1:4190',reuseExistingServer:false}});
