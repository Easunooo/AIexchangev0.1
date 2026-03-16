function getPendingLength(bytes) {
  let pendingLength = 0;

  for (let index = bytes.length - 1; index >= 0 && index >= bytes.length - 4; index -= 1) {
    const value = bytes[index];

    if ((value & 0x80) === 0) {
      break;
    }

    if ((value & 0xc0) === 0x80) {
      pendingLength += 1;
      continue;
    }

    const totalLength = (
      (value & 0xe0) === 0xc0 ? 2 :
      (value & 0xf0) === 0xe0 ? 3 :
      (value & 0xf8) === 0xf0 ? 4 :
      1
    );

    if (pendingLength + 1 < totalLength) {
      pendingLength += 1;
    } else {
      pendingLength = 0;
    }

    break;
  }

  return pendingLength;
}

function decodeUtf8(bytes) {
  let result = '';
  let index = 0;

  while (index < bytes.length) {
    const first = bytes[index];

    if ((first & 0x80) === 0) {
      result += String.fromCharCode(first);
      index += 1;
      continue;
    }

    if ((first & 0xe0) === 0xc0) {
      const second = bytes[index + 1];
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      index += 2;
      continue;
    }

    if ((first & 0xf0) === 0xe0) {
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      result += String.fromCharCode(
        ((first & 0x0f) << 12) |
        ((second & 0x3f) << 6) |
        (third & 0x3f)
      );
      index += 3;
      continue;
    }

    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const fourth = bytes[index + 3];
    const codePoint = (
      ((first & 0x07) << 18) |
      ((second & 0x3f) << 12) |
      ((third & 0x3f) << 6) |
      (fourth & 0x3f)
    );
    const offset = codePoint - 0x10000;

    result += String.fromCharCode(
      0xd800 + (offset >> 10),
      0xdc00 + (offset & 0x3ff)
    );
    index += 4;
  }

  return result;
}

function createUtf8ChunkDecoder() {
  const nativeDecoder = typeof TextDecoder !== 'undefined'
    ? new TextDecoder('utf-8')
    : null;
  let pending = new Uint8Array(0);

  return {
    decode(arrayBuffer) {
      const incoming = new Uint8Array(arrayBuffer);

      if (nativeDecoder) {
        return nativeDecoder.decode(incoming, {
          stream: true
        });
      }

      const merged = new Uint8Array(pending.length + incoming.length);

      merged.set(pending, 0);
      merged.set(incoming, pending.length);

      const pendingLength = getPendingLength(merged);
      const completeLength = merged.length - pendingLength;
      const completeBytes = merged.slice(0, completeLength);

      pending = pendingLength > 0
        ? merged.slice(completeLength)
        : new Uint8Array(0);

      return decodeUtf8(completeBytes);
    },

    flush() {
      if (nativeDecoder) {
        return nativeDecoder.decode();
      }

      if (!pending.length) {
        return '';
      }

      const rest = decodeUtf8(pending);
      pending = new Uint8Array(0);
      return rest;
    }
  };
}

function createSseParser(onEvent) {
  let buffer = '';
  let eventName = 'message';
  let dataLines = [];

  function emit() {
    if (!dataLines.length) {
      eventName = 'message';
      return;
    }

    onEvent({
      event: eventName,
      data: dataLines.join('\n')
    });

    eventName = 'message';
    dataLines = [];
  }

  function processLine(rawLine) {
    const line = rawLine.endsWith('\r')
      ? rawLine.slice(0, -1)
      : rawLine;

    if (!line) {
      emit();
      return;
    }

    if (line.startsWith(':')) {
      return;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1
      ? line
      : line.slice(0, separatorIndex);
    let value = separatorIndex === -1
      ? ''
      : line.slice(separatorIndex + 1);

    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    if (field === 'event') {
      eventName = value || 'message';
      return;
    }

    if (field === 'data') {
      dataLines.push(value);
    }
  }

  return {
    push(chunk) {
      buffer += chunk;

      while (buffer.includes('\n')) {
        const lineBreakIndex = buffer.indexOf('\n');
        const line = buffer.slice(0, lineBreakIndex);

        buffer = buffer.slice(lineBreakIndex + 1);
        processLine(line);
      }
    },

    flush() {
      if (buffer) {
        processLine(buffer);
        buffer = '';
      }

      emit();
    }
  };
}

module.exports = {
  createSseParser,
  createUtf8ChunkDecoder
};
