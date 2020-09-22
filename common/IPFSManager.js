import Ipfs from 'ipfs';

let ipfs = null;

export async function startIpfs() {
  if (ipfs) {
    console.log('IPFS already started');
  } else {
    try {
      console.time('IPFS Started');
      ipfs = await Ipfs.create();
      const ipfsVersion = await ipfs.version();
      const ipfsID = await ipfs.id();
      const ipfsPeers = await ipfs.swarm.peers();
      this.setState({
        ipfsVersion: ipfsVersion.version,
        ipfsID: ipfsID.id,
        ipfsPeers: ipfsPeers,
      });
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
    return;
  }
  const ipfsPeers = await ipfs.swarm.peers();
  if (ipfsPeers.length > 0) {
    let cids = [];
    for await (const { cid, type } of ipfs.pin.ls()) {
      if (type == 'recursive') {
        cids.push(cid);
      }
    }
    this.setState({cids, ipfsPeers});
  } else {
    this.setState({
      ipfsPeers: [],
    });
  }
}

export async function upload(file) {
  const fileInfo = await this.ipfs.add(file);
  console.log('Added file:', fileInfo.path, fileInfo.cid.toString());
  await sleep(1000);
  let cids = [];
  for await (const { cid, type } of this.ipfs.pin.ls()) {
    if (type == 'recursive') {
      cids.push(cid);
    }
  }
}
