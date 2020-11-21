let BlueElectrum = require('../../BlueElectrum');

async function getHost() {
  let {host, tcp, ssl} = BlueElectrum.getCurrentPeer();
  let ipfsProxyPort = ssl ? parseInt(ssl) + 10 : parseInt(tcp) + 10;
  let prefix = ssl ? 'https://' : 'http://';
  return prefix + host + ':' + ipfsProxyPort;
}

export async function getServerInfo() {
  try {
    let host = await getHost();
    const url = host + '/v1/payment_info';
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      }
    });
    if (response.status != 200) {
      throw new Error('Error getting IPFS server info.');
    }
    let json = await response.json();
    return json;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function uploadMedia(image) {
  try {
    let host = await getHost();
    const url = host + '/v1/media';

    const data = new FormData();
    data.append('file', {uri: image, type: 'image/jpeg', name: 'photo.jpeg'});

    let requestOptions = {
      method: 'POST',
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: data
    }

    let response = await fetch(url, requestOptions);
    if (response.status != 200) {
      let json = await response.json();
      console.log(json)
      throw new Error('Error uploading image.');
    }

    // { CID: Q....}
    let json = await response.json();
    return json;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function publishMedia(tx) {
  try {
    let host = await getHost();
    const url = host + '/v1/pin';

    let requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({tx})
    }

    let response = await fetch(url, requestOptions);
    if (response.status != 200) {
      let json = await response.json();
      console.log(json)
      throw new Error(json.message);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
