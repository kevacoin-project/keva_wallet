

const mediaReg = /\{\{([0-9a-zA-Z]+)\|(.+)\}\}/;

// Check if the key contains media, e.g.
// {{QmfPwecQ6hgtNRD1S8NtYQfMKYwBRWJcrteazKJTBejifB|image/jpeg}}
export function extractMedia(keyStr) {
    let mediaMatches = mediaReg.exec(keyStr);
    if (mediaMatches && mediaMatches.length === 3) {
      let keyDisplay = keyStr.substring(mediaMatches[0].length);
      let mediaCID = mediaMatches[1];
      let mimeType = mediaMatches[2];
      return {keyDisplay, mediaCID, mimeType};
    }
    return {keyStr};
}

export function getImageGatewayURL(CID) {
    return `https://gateway.temporal.cloud/ipfs/${CID}`;
}
