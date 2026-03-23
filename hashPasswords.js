const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  console.log(`Password: ${password}`);
  console.log(`Hashed: ${hashedPassword}`);
  console.log('---');
};

const main = async () => {
  console.log('Generating hashed passwords for demo users:');
  await hashPassword('admin123');
  await hashPassword('user123');
};

main();
