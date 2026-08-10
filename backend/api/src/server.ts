import 'dotenv/config'; // Must be first — loads .env before any other module runs
import app from './app';
import prisma from './prisma/client';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test the database connection first
    await prisma.$connect();
    console.log('✔ Koneksi ke PostgreSQL Database Agro Platform terjalin dengan sukses!');

    app.listen(PORT, () => {
      console.log(`✔ Server Gudang Fullstack berjalan dengan lancar pada port ${PORT}`);
      console.log(`🚀 Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('✘ Gagal menyalakan server. Database tidak terjangkau:', error);
    process.exit(1);
  }
};

startServer();
