

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

export function replaceMedia(value, CIDHeight, CIDWidth, poster) {
    let mediaMatches = mediaReg.exec(value);
    if (mediaMatches && mediaMatches.length >= 3) {
      let mediaStr = mediaMatches[0];
      let mediaCID = mediaMatches[1];
      let mimeType = mediaMatches[2];
      const mediaURL = getImageGatewayURL(mediaCID);
      if (mimeType.startsWith('image')) {
        const img = `<br/><img src="${mediaURL}" height="${CIDHeight}" width="${CIDWidth}" />`
        return value.replace(mediaStr, img);
      } else if (mimeType.startsWith('video')) {
        const video = `<br/><video height="${CIDHeight}" width="${CIDWidth}" poster="${poster}"><source src="${mediaURL}" type="${mimeType}"></video>`
        return value.replace(mediaStr, video);
      }
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

export function constructMedia(mediaCID, mimeType) {
    return `{{${mediaCID}|${mimeType}}}`;
}
