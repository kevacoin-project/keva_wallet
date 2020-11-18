

const mediaReg = /\{\{([0-9a-zA-Z]+)\|(.+)\}\}/;

// Check if the key contains media, e.g.
// {{QmfPwecQ6hgtNRD1S8NtYQfMKYwBRWJcrteazKJTBejifB|image/jpeg}}
export function extractMedia(value) {
    let mediaMatches = mediaReg.exec(value);
    if (mediaMatches && mediaMatches.length >= 3) {
      let mediaCID = mediaMatches[1];
      let mimeType = mediaMatches[2];
      return {mediaCID, mimeType};
    }
    return {};
}

export function getImageGatewayURL(CID) {
    return `https://gateway.temporal.cloud/ipfs/${CID}`;
}

export function replaceMedia(value, CIDHeight, CIDWidth) {
    let mediaMatches = mediaReg.exec(value);
    if (mediaMatches && mediaMatches.length >= 3) {
      let mediaStr = mediaMatches[0];
      let mediaCID = mediaMatches[1];
      let mimeType = mediaMatches[2];
      const mediaURL = getImageGatewayURL(mediaCID);
      const img = `<br/><img src="${mediaURL}" height="${CIDHeight}" width="${CIDWidth}" />`
      return value.replace(mediaStr, img);
    }
    return value;
}

export function removeMedia(value) {
    let mediaMatches = mediaReg.exec(value);
    if (mediaMatches && mediaMatches.length >= 3) {
      let mediaStr = mediaMatches[0];
      return value.replace(mediaStr, "");
    }
    return value;
}
