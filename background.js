import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const EXT_ID = "com.metalpig.land-of-eem";
const META_KEY = `${EXT_ID}/character`;
const OPEN_TOKEN_KEY = `${EXT_ID}/open-token`;
const CHANNEL_NAME = `${EXT_ID}/popout`;

async function getTokenPayload(tokenId) {
  if (!tokenId) return null;
  const ready = await OBR.scene.isReady();
  if (!ready) return null;
  const items = await OBR.scene.items.getItems();
  const item = items.find(i => i.id === tokenId);
  const stored = item?.metadata?.[META_KEY];
  return stored && typeof stored === "object" ? stored : null;
}

async function saveTokenPayload(tokenId, payload) {
  if (!tokenId || !payload) return false;
  const ready = await OBR.scene.isReady();
  if (!ready) return false;
  await OBR.scene.items.updateItems([tokenId], items => {
    for (const item of items) item.metadata[META_KEY] = payload;
  });
  return true;
}

OBR.onReady(async () => {
  await OBR.contextMenu.create({
    id: `${EXT_ID}/open-character`,
    icons: [
      {
        icon: "./icon.png",
        label: "Open Land of Eem Character",
        filter: {
          min: 1,
          max: 1,
          every: [
            { key: "layer", value: "CHARACTER" },
            { key: ["metadata", META_KEY], operator: "!=", value: undefined }
          ]
        }
      }
    ],
    async onClick(context) {
      const token = context.items?.[0];
      if (!token) return;
      await OBR.player.setMetadata({ [OPEN_TOKEN_KEY]: token.id });
      await OBR.action.open();
    }
  });

  // The background page remains active while the room is open.  It bridges a
  // standalone browser pop-out to Owlbear's scene-item metadata.
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", async event => {
    const msg = event.data ?? {};
    if (!msg.requestId) return;
    try {
      if (msg.type === "load") {
        const payload = await getTokenPayload(msg.tokenId);
        channel.postMessage({ type: "load-result", requestId: msg.requestId, ok: !!payload, payload });
      } else if (msg.type === "save") {
        const ok = await saveTokenPayload(msg.tokenId, msg.payload);
        channel.postMessage({ type: "save-result", requestId: msg.requestId, ok });
      }
    } catch (error) {
      channel.postMessage({ type: `${msg.type}-result`, requestId: msg.requestId, ok: false, error: String(error?.message ?? error) });
    }
  });
});
