const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1200,
    minHeight: 750,
    show: false, // لا يظهر إلا بعد اكتمال التحميل
    autoHideMenuBar: true, // إخفاء قائمة الملفات العلوية لشكل أنظف
    backgroundColor: '#f1f5f9', // لون خلفية متناسق مع CSS
    title: 'Print Farm App',
    // إذا كان لديك أيقونة، ضعها في مجلد المشروع وسمها icon.ico
    icon: path.join(__dirname, 'build/icon.ico'), 
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js') // اختياري إذا أردت إضافة بريلود مستقبلاً
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // إظهار النافذة بمجرد أن تصبح جاهزة (يمنع الوميض الأبيض)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // فتح الروابط الخارجية (مثل جيت هاب أو لينكات المساعدة) في المتصفح الافتراضي للجهاز
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // منع التنقل الداخلي لزيادة الأمان
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// تشغيل التطبيق
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// إغلاق البرنامج تماماً عند إغلاق النافذة (في الويندوز واللينكس)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
