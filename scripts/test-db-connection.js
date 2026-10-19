// اسکریپت تست اتصال به MongoDB
import mongoose from 'mongoose';

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/store-base';

async function testConnection() {
  console.log('🔍 در حال تست اتصال به MongoDB...');
  console.log(`📍 Connection String: ${url.replace(/\/\/.*@/, '//***:***@')}`);
  
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(url, options);
    
    console.log('✅ اتصال موفق!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    console.log(`📈 Ready State: ${mongoose.connection.readyState}`);
    
    // تست یک query ساده
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 تعداد Collections: ${collections.length}`);
    if (collections.length > 0) {
      console.log('📋 Collections موجود:');
      collections.forEach(col => console.log(`   - ${col.name}`));
    }
    
    await mongoose.disconnect();
    console.log('👋 اتصال بسته شد');
    process.exit(0);
  } catch (error) {
    console.error('❌ خطا در اتصال:');
    console.error(`   نام خطا: ${error.name}`);
    console.error(`   پیام: ${error.message}`);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('\n💡 راه‌حل‌های ممکن:');
      console.error('   1. مطمئن شوید MongoDB در حال اجرا است');
      console.error('   2. دستور زیر را برای اجرای MongoDB استفاده کنید:');
      console.error('      Windows: mongod --dbpath "C:\\data\\db"');
      console.error('      macOS: brew services start mongodb-community');
      console.error('      Linux: sudo systemctl start mongodb');
      console.error('   3. بررسی کنید پورت 27017 باز است');
      console.error('   4. فایروال را بررسی کنید');
    }
    
    process.exit(1);
  }
}

testConnection();