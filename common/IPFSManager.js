import nodejs from 'nodejs-mobile-react-native';

let ipfs = null;

export async function startIpfs() {
  // Nodejs is singleton object.
  nodejs.start("main.js");
  nodejs.channel.send('startIpfs');
}

export async function stopIpfs() {
  nodejs.channel.send('stopIpfs');
}

export async function checkPeers() {
}

export async function upload(file) {
}
