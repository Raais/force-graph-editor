const elDataEditor = document.getElementById("data-editor");
const elGraph = document.getElementById("graph");
const elSaveButton = document.getElementById("save-btn");
const elClearButton = document.getElementById("clr-btn");
const elCopyButton = document.getElementById("cpy-btn");
const elPasteButton = document.getElementById("pst-btn");
const el3DToggle = document.getElementById("3d-toggle");
const elStatusBar = document.getElementById("status");

const elAddNodeID = document.getElementById("add-node-id");
const elAddNodeGroup = document.getElementById("add-node-grp");
const elAddNodeButton = document.getElementById("add-node-btn");

const elAddLinkSource = document.getElementById("add-link-src");
const elAddLinkTarget = document.getElementById("add-link-tgt");
const elAddLinkValue = document.getElementById("add-link-val");
const elAddLinkButton = document.getElementById("add-link-btn");

const elRemoveNodeID = document.getElementById("remove-node-id");
const elRemoveNodeButton = document.getElementById("remove-node-btn");

const elRemoveLinkSource = document.getElementById("remove-link-src");
const elRemoveLinkTarget = document.getElementById("remove-link-tgt");
const elRemoveLinkButton = document.getElementById("remove-link-btn");

const elRenameFrom = document.getElementById("rename-from");
const elRenameTo = document.getElementById("rename-to");
const elRenameButton = document.getElementById("rename-btn");

async function main() {
  const params = new URLSearchParams(location.search);
  // ?new=true
  // ?charge=-120
  // ?graph=3d

  const emptyData = {
    nodes: [],
    links: []
  };

  let editorData = emptyData;
  // sample data - miserables.json
  if (params.get("new") !== "true")
    editorData = await fetchData("sample/miserables.json");

  // json code editor
  const editor = CodeMirror(elDataEditor, {
    value: JSON.stringify(editorData, null, 2),
    mode: "javascript",
    styleActiveLine: true,
    matchBrackets: true,
    lineNumbers: true
  });
  editor.setSize("100%", "100%");
  editor.setOption("theme", "dracula");

  // force-directed graph
  var graphCharge = Number(params.get("charge"));
  if (!graphCharge) graphCharge = -120;

  var graphType = params.get("graph");
  if (!graphType) graphType = "2d";
  var currentGraph;

  createGraph(graphType);

  elSaveButton.addEventListener("click", () => {
    save();
  });

  elClearButton.addEventListener("click", () => {
    editor.setValue("");
    editor.setValue(JSON.stringify(emptyData, null, 2));
  });

  elCopyButton.onclick = () => {
    const json = JSON.parse(editor.getValue());
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
  };

  elPasteButton.onclick = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const json = JSON.parse(clipboardText);
      editor.setValue("");
      editor.setValue(JSON.stringify(json, null, 2));
      save();
    } catch (err) {
      console.error("Failed to read clipboard text: ", err);
    }
  };

  el3DToggle.onchange = (event) => {
    if (event.target.checked) {
      createGraph("3d");
    } else {
      createGraph("2d");
    }
  };

  window.onerror = function (e) {
    elStatusBar.innerHTML += ", errors: " + e.toString();
  };

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === ".") {
      // ctrl . to save
      save();
    }
  });

  function save() {
    // save editor buffer
    sanitizeJson();
    const json = JSON.parse(editor.getValue());
    if (currentGraph) {
      currentGraph.graphData(json);
    }
    elStatusBar.innerHTML =
      json.nodes.length + " nodes, " + json.links.length + " links";
  }

  elAddNodeButton.onclick = () => {
    // add node as one or multiple comma separated values
    const id = elAddNodeID.value.trim();
    const group = elAddNodeGroup.value;
    if (id && group) {
      const json = JSON.parse(editor.getValue());
      let nodes = [id];
      if (id.includes(",")) {
        nodes = id.split(",").map((node) => node.trim());
      }
      nodes.forEach((node) => {
        if (node.trim()) {
          if (!json.nodes.map((n) => n.id).includes(node)) {
            json.nodes.push({ id: node, group: Number(group) });
          }
        }
      });
      editor.setValue(JSON.stringify(json, null, 2));
      save();
      elAddNodeID.value = "";
      elAddNodeID.focus();
    }
  };

  elAddLinkButton.onclick = () => {
    // targets can be multiple comma separated values
    const [source, target, value] = [
      elAddLinkSource.value,
      elAddLinkTarget.value,
      elAddLinkValue.value
    ];
    const json = JSON.parse(editor.getValue());
    const nodes = json.nodes.map((node) => node.id);
    if (target.includes(",")) {
      const targets = target.split(",");
      targets.forEach((tgt) => {
        if (nodes.includes(source) && nodes.includes(tgt)) {
          json.links.push({ source, target: tgt, value: Number(value) });
        }
      });
    } else {
      const links = json.links.map((link) =>
        [link.source, link.target].sort().join("-")
      );
      const newLink = [source, target].sort().join("-");
      if (
        nodes.includes(source) &&
        nodes.includes(target) &&
        !links.includes(newLink)
      ) {
        json.links.push({ source, target, value: Number(value) });
      }
    }
    editor.setValue(JSON.stringify(json, null, 2));
    save();
    elAddLinkTarget.value = "";
    elAddLinkValue.value = 1;
    elAddLinkTarget.focus();
  };

  elRemoveNodeButton.onclick = () => {
    // remove node along with any links (both source and target)
    // works with multiple comma separated values
    const nodeToRemove = elRemoveNodeID.value;
    const json = JSON.parse(editor.getValue());

    if (nodeToRemove.includes(",")) {
      const nodesToRemove = nodeToRemove.split(",");
      nodesToRemove.forEach((node) => {
        json.nodes = json.nodes.filter((node) => node.id !== node);
        json.links = json.links.filter(
          (link) => link.source !== node && link.target !== node
        );
      });
    } else {
      const nodes = json.nodes.filter((node) => node.id !== nodeToRemove);
      const links = json.links.filter(
        (link) => link.source !== nodeToRemove && link.target !== nodeToRemove
      );
      if (json.nodes.length !== nodes.length) {
        json.nodes = nodes;
        json.links = links;
      }
    }
    editor.setValue(JSON.stringify(json, null, 2));
    save();
    elRemoveNodeID.value = "";
    elRemoveNodeID.focus();
  };

  elRemoveLinkButton.onclick = () => {
    // removes only links (both source and target)
    const [src, tgt] = [
      elRemoveLinkSource.value,
      elRemoveLinkTarget.value
    ].sort();
    const json = JSON.parse(editor.getValue());
    const links = json.links.filter((link) => {
      const [linkSrc, linkTgt] = [link.source, link.target].sort();
      return linkSrc !== src || linkTgt !== tgt;
    });
    if (json.links.length !== links.length) {
      json.links = links;
      editor.setValue(JSON.stringify(json, null, 2));
      save();
      elRemoveLinkSource.value = "";
      elRemoveLinkTarget.value = "";
    }
  };

  elRenameButton.onclick = () => {
    // rename all occurrances of a node id from both nodes and links
    const to = elRenameTo.value.trim();
    if (to && !to.includes(",")) {
      const json = JSON.parse(editor.getValue());
      json.nodes = json.nodes.map((node) => {
        if (node.id === elRenameFrom.value) {
          return { ...node, id: to };
        } else {
          return node;
        }
      });
      json.links = json.links.map((link) => {
        if (link.source === elRenameFrom.value) {
          return { ...link, source: to };
        } else if (link.target === elRenameFrom.value) {
          return { ...link, target: to };
        } else {
          return link;
        }
      });
      editor.setValue(JSON.stringify(json, null, 2));
      save();
      elRenameFrom.value = "";
      elRenameTo.value = "";
      elRenameFrom.focus();
    }
  };

  const autocomp_elAddNodeID = new autoComplete({
    data: {
      src: async function () {
        // all existing nodes
        return JSON.parse(editor.getValue()).nodes.map((node) => node.id);
      }
    },
    cache: false,
    selector: () => {
      return elAddNodeID;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elAddNodeID.input.value = event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elAddLinkSource = new autoComplete({
    data: {
      src: async function () {
        // all existing nodes
        return JSON.parse(editor.getValue()).nodes.map((node) => node.id);
      }
    },
    cache: false,
    selector: () => {
      return elAddLinkSource;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elAddLinkSource.input.value = event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elRemoveNodeID = new autoComplete({
    data: {
      src: async function () {
        // all existing nodes
        return JSON.parse(editor.getValue()).nodes.map((node) => node.id);
      }
    },
    cache: false,
    selector: () => {
      return elRemoveNodeID;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elRemoveNodeID.input.value = event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elRemoveLinkSource = new autoComplete({
    data: {
      src: async function () {
        // all existing nodes
        return JSON.parse(editor.getValue()).nodes.map((node) => node.id);
      }
    },
    cache: false,
    selector: () => {
      return elRemoveLinkSource;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elRemoveLinkSource.input.value =
            event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elRenameFrom = new autoComplete({
    data: {
      src: async function () {
        // all existing nodes
        return JSON.parse(editor.getValue()).nodes.map((node) => node.id);
      }
    },
    cache: false,
    selector: () => {
      return elRenameFrom;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elRenameFrom.input.value = event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elRenameTo = new autoComplete({
    data: {
      src: async function () {
        // all existing nodes
        return JSON.parse(editor.getValue()).nodes.map((node) => node.id);
      }
    },
    cache: false,
    selector: () => {
      return elRenameTo;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elRenameTo.input.value = event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elAddLinkTarget = new autoComplete({
    data: {
      src: async function () {
        let json = JSON.parse(editor.getValue());
        let linkedNodes = new Set();
        let node = elAddLinkSource.value;
        json.links.forEach(({ source, target }) => {
          if (source === node) linkedNodes.add(target);
          if (target === node) linkedNodes.add(source);
        });
        // nodes NOT already linked
        return json.nodes
          .map(({ id }) => id)
          .filter((id) => id !== node && !linkedNodes.has(id));
      }
    },
    cache: false,
    selector: () => {
      return elAddLinkTarget;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elAddLinkTarget.input.value = event.detail.selection.value;
        }
      }
    }
  });

  const autocomp_elRemoveLinkTarget = new autoComplete({
    data: {
      src: async function () {
        let json = JSON.parse(editor.getValue());
        let removeLinkSrc = elRemoveLinkSource.value;
        let linkedTargets = new Set();
        json.links.forEach(({ source, target }) => {
          if (source === removeLinkSrc) linkedTargets.add(target);
          if (target === removeLinkSrc) linkedTargets.add(source);
        });
        // only linked nodes
        return [...linkedTargets];
      }
    },
    cache: false,
    selector: () => {
      return elRemoveLinkTarget;
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        selection: (event) => {
          autocomp_elRemoveLinkTarget.input.value =
            event.detail.selection.value;
        }
      }
    }
  });

  function sanitizeJson() {
    let json = JSON.parse(editor.getValue());
    let existingCombos = new Set();
    let duplicateCombos = [];

    json.links.forEach((link) => {
      const sortedCombo = [link.source, link.target].sort().join("-");
      if (link.source === link.target) {
        // node linked to itself
        duplicateCombos.push(link);
      } else if (existingCombos.has(sortedCombo)) {
        // two nodes linked twice (either way) eg. adam-dave, dave-adam
        duplicateCombos.push(link);
      } else {
        existingCombos.add(sortedCombo);
      }
    });
    // remove duplicates
    json.links = json.links.filter((link) => !duplicateCombos.includes(link));
    json.nodes = json.nodes.filter(
      (node, index, self) => self.map((n) => n.id).indexOf(node.id) === index
    );
    editor.setValue(JSON.stringify(json, null, 2));
  }

  function createGraph(type) {
    if (currentGraph) currentGraph._destructor();

    if (type === "3d") {
      currentGraph = ForceGraph3D()(elGraph)
        .graphData(JSON.parse(editor.getValue()))
        .width(document.querySelector(".right").offsetWidth)
        .nodeAutoColorBy("group")
        .nodeThreeObject((node) => {
          const sprite = new SpriteText(node.id);
          sprite.material.depthWrite = false;
          sprite.color = node.color;
          sprite.textHeight = 8;
          return sprite;
        });
      currentGraph.d3Force("charge").strength(graphCharge);
      graphType = "3d";
    } else {
      currentGraph = ForceGraph()(elGraph)
        .graphData(JSON.parse(editor.getValue()))
        .width(document.querySelector(".right").offsetWidth)
        .backgroundColor("#1c1f24")
        .linkColor(() => "rgba(255,255,255,0.2)")
        .nodeId("id")
        .nodeAutoColorBy("group")
        .nodeCanvasObject((node, ctx, globalScale) => {
          const nodeId = node.id;
          const groupNumber = node.group;
          const label = nodeId + " " + groupNumber;

          const fontSize = 12 / globalScale;
          const fontSize2 = 8 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = node.color;
          ctx.fillText(nodeId, node.x, node.y);

          ctx.font = `${fontSize2}px Sans-Serif`;
          ctx.fillStyle = "grey";
          ctx.fillText(groupNumber, node.x, node.y + fontSize2);

          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );

          ctx.fillStyle = "rgba(255, 255, 255, 0.0)";
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2 + 5,
            node.y - bckgDimensions[1] / 2 - 1,
            ...bckgDimensions
          );

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          node.__bckgDimensions = bckgDimensions;
        })
        .nodePointerAreaPaint((node, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          bckgDimensions &&
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2,
              ...bckgDimensions
            );
        });
      currentGraph.d3Force("charge").strength(graphCharge);
      graphType = "2d";
    }
  }
}
main();

async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}
