import { generateKeyPairSync, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [command, ...argumentsList] = process.argv.slice(2);
const option = (name) => {
  const index = argumentsList.indexOf(`--${name}`);
  return index === -1 ? undefined : argumentsList[index + 1];
};
const requireOption = (name) => {
  const value = option(name);
  if (!value || value.startsWith('--')) throw new Error(`缺少 --${name}`);
  return value;
};
const usage = '用法：node scripts/membership-keys.mjs init --private <私钥.pem> --public <公钥.txt>\n' +
  '      node scripts/membership-keys.mjs generate --private <私钥.pem> --out <密钥.txt> --count <数量>';

try {
  if (command === 'init') {
    const privatePath = requireOption('private');
    const publicPath = requireOption('public');
    if (privatePath === publicPath || existsSync(privatePath) || existsSync(publicPath)) throw new Error('目标文件已存在，或私钥和公钥路径相同；不会覆盖');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const publicBase64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    writeFileSync(privatePath, privatePem, { flag: 'wx', mode: 0o600 });
    writeFileSync(publicPath, `${publicBase64}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`密钥对已生成。公钥文件：${publicPath}；私钥文件：${privatePath}`);
  } else if (command === 'generate') {
    const privatePath = requireOption('private');
    const outputPath = requireOption('out');
    const count = Number(requireOption('count'));
    if (!Number.isSafeInteger(count) || count < 1 || count > 10000) throw new Error('数量必须是 1–10000 的整数，可重复运行以生成更多');
    if (existsSync(outputPath)) throw new Error('输出文件已存在；不会覆盖或重复发放');
    const privateKey = createPrivateKey(readFileSync(privatePath));
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('私钥不是 Ed25519');
    const keys = new Set();
    while (keys.size < count) {
      const nonce = randomBytes(16).toString('base64url');
      const payload = Buffer.from(`ZGB-MEMBER|VIP1|30D|${nonce}`, 'utf8');
      const signature = sign(null, payload, privateKey).toString('base64url');
      keys.add(`VIP1.${nonce}.${signature}`);
    }
    writeFileSync(outputPath, `${[...keys].join('\n')}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`已生成 ${keys.size} 个会员密钥：${outputPath}`);
  } else {
    throw new Error(usage);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
