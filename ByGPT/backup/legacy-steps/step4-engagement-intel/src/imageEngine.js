export function generateImageKeyword(topic, tags = []) {
  if (tags.includes("hindu")) {
    return `${topic} temple aerial view`;
  }

  if (tags.includes("politics")) {
    return `${topic} Indian government official press meet`;
  }

  if (tags.includes("global")) {
    return `${topic} India geopolitics map`;
  }

  if (tags.includes("humanity")) {
    return `${topic} relief operation India`;
  }

  return `${topic} India news photo`;
}
