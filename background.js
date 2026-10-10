import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const EXT_ID = "com.metalpig.land-of-eem";
const META_KEY = `${EXT_ID}/character`;
const ROLL_CHANNEL = `${EXT_ID}/roll`;
const ROLL_POPOVER = `${EXT_ID}/roll-card`;
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

const ROLL_SETTINGS_KEY = "eem-roll-card-settings-v1";
const DEFAULT_ROLL_SETTINGS = { position: "top", duration: 5 };
function rollSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(ROLL_SETTINGS_KEY) || "{}");
    return {
      position: ["top", "left", "right"].includes(stored.position) ? stored.position : "top",
      duration: [3, 5, 7, 10, 15, 0].includes(Number(stored.duration)) ? Number(stored.duration) : 5
    };
  } catch { return { ...DEFAULT_ROLL_SETTINGS }; }
}
async function rollAnchor(position) {
  // Owlbear viewport dimensions are screen-space pixels. The previous implementation
  // calculated a top-left coordinate and then Owlbear applied its default anchor
  // transform, shifting the card away from the requested screen position.
  let width = 0, height = 0;
  try {
    [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  } catch (error) { console.warn("Viewport dimensions unavailable", error); }
  if (!(width > 0 && height > 0)) {
    // A best-effort fallback, not a claim that an iframe measures the host viewport.
    width = Math.max(window.innerWidth, 640);
    height = Math.max(window.innerHeight, 480);
  }
  const gutter = 18;
  if (position === "left") return {
    anchorPosition: { left: gutter, top: height / 2 },
    anchorOrigin: { horizontal: "LEFT", vertical: "CENTER" },
    transformOrigin: { horizontal: "LEFT", vertical: "CENTER" }
  };
  if (position === "right") return {
    anchorPosition: { left: width - gutter, top: height / 2 },
    anchorOrigin: { horizontal: "RIGHT", vertical: "CENTER" },
    transformOrigin: { horizontal: "RIGHT", vertical: "CENTER" }
  };
  return {
    anchorPosition: { left: width / 2, top: gutter },
    anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
    transformOrigin: { horizontal: "CENTER", vertical: "TOP" }
  };
}
async function showRollCard(data) {
  const text = String(data.text ?? "").slice(0, 3000);
  if (!text) return;
  const url = new URL("./roll-card.html", location.href);
  url.searchParams.set("text", text);
  url.searchParams.set("name", text.split("\n")[0] || "Adventurer");
  url.searchParams.set("id", String(data.id || Date.now()));
  const settings = rollSettings();
  url.searchParams.set("duration", String(settings.duration));
  url.searchParams.set("position", settings.position);
  try {
    await OBR.popover.close(ROLL_POPOVER).catch(() => {});
    await OBR.popover.open({
      id: ROLL_POPOVER, url: url.href, width: 400, height: 370,
      anchorReference: "POSITION", ...(await rollAnchor(settings.position)),
      disableClickAway: true
    });
  } catch (error) {
    console.warn("Land of Eem roll card unavailable", error);
    await OBR.notification.show(text, "INFO");
  }
}

OBR.onReady(async () => {
  OBR.broadcast.onMessage(ROLL_CHANNEL, async event => {
    const data = event?.data ?? {};
    if (data.type === "roll-result" && data.text) {
      await showRollCard(data);
    }
  });
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
      } else if (msg.type === "popout-broadcast-roll") {
        await OBR.broadcast.sendMessage(ROLL_CHANNEL, { type: "roll-result", text: String(msg.text ?? ""), id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }, { destination: "REMOTE" });
        reply(event.source, event.origin, msg.requestId, "popout-broadcast-roll-result", { ok: true });
      }
    } catch (error) {
      reply(event.source, event.origin, msg.requestId, `${msg.type}-result`, { ok: false, error: String(error?.message ?? error) });
    }
  });
});
