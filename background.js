import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const EXT_ID = "com.metalpig.land-of-eem";
const META_KEY = `${EXT_ID}/character`;
const POPUP_PREFIX = "land-of-eem-";

async function getTokenPayload(tokenId) {
  if (!tokenId || !(await OBR.scene.isReady())) return null;
  const items = await OBR.scene.items.getItems([tokenId]);
  const item = items?.[0];
  const stored = item?.metadata?.[META_KEY];
  return stored && typeof stored === "object" ? stored : null;
}

async function saveTokenPayload(tokenId, payload) {
  if (!tokenId || !payload || !(await OBR.scene.isReady())) return false;
  await OBR.scene.items.updateItems([tokenId], items => {
    for (const item of items) item.metadata[META_KEY] = payload;
  });
  return true;
}

function openCharacterWindow(tokenId) {
  const url = new URL("./popout.html", window.location.href);
  url.searchParams.set("token", tokenId);
  const win = window.open(
    url.href,
    `${POPUP_PREFIX}${tokenId}`,
    "popup=yes,width=1000,height=900,resizable=yes,scrollbars=yes"
  );
  if (!win) OBR.notification.show("Pop-up blocked. Allow pop-ups for this site and try again.", "WARNING");
  else win.focus();
}

function reply(target, origin, requestId, type, body = {}) {
  try { target?.postMessage({ source: EXT_ID, requestId, type, ...body }, origin); } catch {}
}

OBR.onReady(async () => {
  // Keep the filter deliberately simple. Owlbear supports layer filters here;
  // metadata availability is checked after the user clicks the button.
  await OBR.contextMenu.create({
    id: `${EXT_ID}/open-character`,
    icons: [{
      icon: "https://metalpig-art.github.io/land-of-eem-owlbear/icon.svg",
      label: "Open Land of Eem Character",
      filter: {
        min: 1,
        max: 1,
        every: [{ key: "layer", value: "CHARACTER" }]
      }
    }],
    async onClick(context) {
      const token = context.items?.[0];
      if (!token) return;
      const payload = token.metadata?.[META_KEY] ?? await getTokenPayload(token.id);
      if (!payload?.sheet) {
        await OBR.notification.show("This token does not have a Land of Eem character saved to it yet.", "WARNING");
        return;
      }
      // Open directly from this persistent background page. The popped-out
      // window can then use window.opener to keep talking to Owlbear.
      openCharacterWindow(token.id);
    }
  });

  // Bridge the top-level pop-out window to the Owlbear SDK. postMessage is
  // used instead of BroadcastChannel because modern browsers partition
  // iframe storage/channels by top-level site.
  window.addEventListener("message", async event => {
    if (event.origin !== location.origin) return;
    const msg = event.data ?? {};
    if (msg.source !== EXT_ID || !msg.requestId) return;
    try {
      if (msg.type === "popout-load") {
        const payload = await getTokenPayload(msg.tokenId);
        reply(event.source, event.origin, msg.requestId, "popout-load-result", { ok: !!payload?.sheet, payload });
      } else if (msg.type === "popout-save") {
        const ok = await saveTokenPayload(msg.tokenId, msg.payload);
        reply(event.source, event.origin, msg.requestId, "popout-save-result", { ok });
      }
    } catch (error) {
      reply(event.source, event.origin, msg.requestId, `${msg.type}-result`, { ok: false, error: String(error?.message ?? error) });
    }
  });
});
