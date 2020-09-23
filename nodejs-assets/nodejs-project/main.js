const rn_bridge = require('rn-bridge');

let ipfs = null;

export async function startIpfs() {
  if (ipfs) {
    console.log('IPFS already started');
  } else {
    try {
      console.time('IPFS Started');
      ipfs = await Ipfs.create();
      console.timeEnd('IPFS Started');
    } catch (error) {
      console.error('IPFS init error:', error);
      ipfs = null;
    }
  }
}

export async function stopIpfs() {
  if (ipfs && ipfs.stop) {
    console.log('Stopping IPFS');
    ipfs.stop().catch(err => console.error(err));
    ipfs = null;
  }
}

export async function checkPeers() {
  if (!ipfs) {
    return [];
  }
  const ipfsPeers = await ipfs.swarm.peers();
  if (ipfsPeers.length == 0) {
    return [];
  }

  let cids = [];
  for await (const { cid, type } of ipfs.pin.ls()) {
    if (type == 'recursive') {
      cids.push(cid);
    }
  }
  return cids;
}

export async function upload(file) {
  console.log(file)
  const fileInfo = await this.ipfs.add(file);
  console.log('Added file:', fileInfo.path, fileInfo.cid.toString());
  return fileInfo;
}

export async function getPinnedFiles() {
  let cids = [];
  for await (const { cid, type } of this.ipfs.pin.ls()) {
    if (type == 'recursive') {
      cids.push(cid);
    }
  }
}


rn_bridge.channel.on('message', async (msg) => {
  if (msg === 'startIPFS') {
    await startIpfs();
  } else if (msg === 'stopIPFS') {
    await stopIpfs();
  }
  //rn_bridge.channel.send(msg);
} );

// Inform react-native node is initialized.
rn_bridge.channel.send("Node was initialized.");
