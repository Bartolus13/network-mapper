(() => {
  const canvas = document.getElementById('canvas');
  const svg = document.getElementById('svglines');
  const paletteItems = document.querySelectorAll('.palette-item');
  const selectedNameInput = document.getElementById('selectedName');
  const selectedPortsInput = document.getElementById('selectedPorts');
  const deleteSelectedBtn = document.getElementById('deleteSelected');
  let idCounter = 1;

  let selectedNode = null;

  function clientToSvg(x, y){
    const r = svg.getBoundingClientRect();
    return {x: x - r.left, y: y - r.top};
  }

  function createNode(type, x, y, portCount = 1, name){
    const id = 'n' + (idCounter++);
    const el = document.createElement('div');
    el.className = 'node ' + type;
    el.dataset.id = id;
    el.dataset.type = type;
    el.dataset.portCount = portCount;
    el.dataset.name = name || `${type} ${id}`;
    el.innerHTML = `<div class="label">${el.dataset.name}</div><div class="ports"></div>`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    canvas.appendChild(el);

    rebuildPorts(el, portCount);
    makeDraggable(el);
    el.addEventListener('mousedown', e => {
      if (!e.target.classList.contains('port')) selectNode(el);
    });
    return el;
  }

  function selectNode(node){
    if (selectedNode === node) return;
    if (selectedNode) selectedNode.classList.remove('selected');
    selectedNode = node;
    if (selectedNode) selectedNode.classList.add('selected');
    if (selectedNode){
      selectedNameInput.value = selectedNode.dataset.name || '';
      selectedPortsInput.value = selectedNode.dataset.portCount || '1';
    } else {
      selectedNameInput.value = '';
      selectedPortsInput.value = '1';
    }
  }

  function makeDraggable(el){
    let startX, startY, ox, oy, rect;
    el.addEventListener('mousedown', e => {
      if (e.target.classList.contains('port') || e.target.classList.contains('port-label')) return;
      e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      rect = el.getBoundingClientRect();
      const parentRect = canvas.getBoundingClientRect();
      ox = rect.left - parentRect.left; oy = rect.top - parentRect.top;

      function onMove(ev){
        const nx = Math.max(0, Math.min(canvas.clientWidth - rect.width, ox + (ev.clientX - startX)));
        const ny = Math.max(0, Math.min(canvas.clientHeight - rect.height, oy + (ev.clientY - startY)));
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        updateAllLines();
      }

      function onUp(){ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  const connections = [];
  let tempLine = null;
  let startPort = null;
  let selectedConnection = null;

  function makePortInteractive(port){
    port.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      startPort = port;
      const pRect = port.getBoundingClientRect();
      const start = clientToSvg(pRect.left + pRect.width/2, pRect.top + pRect.height/2);
      tempLine = createSvgLine(start.x, start.y, start.x, start.y, true);

      function onMove(ev){
        const pos = clientToSvg(ev.clientX, ev.clientY);
        setLineEnd(tempLine, pos.x, pos.y);
      }

      function onUp(ev){
        window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        if (target && target.classList && target.classList.contains('port') && target !== startPort){
          if (connectionExistsBetween(startPort, target)){
            tempLine.remove(); tempLine = null; startPort = null; return;
          }
          const portBusy = connections.some(c => c.a === startPort || c.b === startPort || c.a === target || c.b === target);
          if (portBusy){
            tempLine.remove(); tempLine = null; startPort = null; return;
          }
          const a = portCenterSvg(startPort), b = portCenterSvg(target);
          setLineCoords(tempLine, a.x, a.y, b.x, b.y);
          tempLine.classList.remove('temp');
          connections.push({line: tempLine, a: startPort, b: target});
          attachLineDelete(tempLine);
          tempLine = null; startPort = null;
        } else {
          if (tempLine) tempLine.remove(); tempLine = null; startPort = null;
        }
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function connectionExistsBetween(p1, p2){
    return connections.some(c => (c.a === p1 && c.b === p2) || (c.a === p2 && c.b === p1));
  }

  function attachLineDelete(line){
    line.style.cursor = 'pointer';
    line.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedConnection && selectedConnection !== line){ selectedConnection.classList.remove('selected-conn'); }
      selectedConnection = line;
      line.classList.add('selected-conn');
    });
    line.addEventListener('dblclick', (e) => { e.stopPropagation(); removeConnectionByLine(line); });
  }

  function portCenterSvg(port){
    const r = svg.getBoundingClientRect();
    const pr = port.getBoundingClientRect();
    return {x: pr.left + pr.width/2 - r.left, y: pr.top + pr.height/2 - r.top};
  }

  function createSvgLine(x1,y1,x2,y2,temp){
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke','#2b6'); l.setAttribute('stroke-width','3'); l.setAttribute('stroke-linecap','round');
    if (temp) { l.classList.add('temp'); l.setAttribute('stroke','#999'); l.setAttribute('stroke-dasharray','6 4'); }
    svg.appendChild(l); return l;
  }

  function setLineEnd(line,x,y){ line.setAttribute('x2',x); line.setAttribute('y2',y); }
  function setLineCoords(line,x1,y1,x2,y2){ line.setAttribute('x1',x1); line.setAttribute('y1',y1); line.setAttribute('x2',x2); line.setAttribute('y2',y2); }

  function removeConnectionByLine(line){
    const idx = connections.findIndex(c => c.line === line);
    if (idx >= 0){
      connections[idx].line.remove();
      if (selectedConnection === line) selectedConnection = null;
      connections.splice(idx,1);
    }
  }

  function updateAllLines(){
    connections.forEach(c => {
      const a = portCenterSvg(c.a), b = portCenterSvg(c.b);
      setLineCoords(c.line, a.x, a.y, b.x, b.y);
    });
  }

  function rebuildPorts(node, count){
    count = Math.max(1, Math.min(8, Number(count) || 1));
    node.dataset.portCount = count;
    const portsContainer = node.querySelector('.ports');
    const existing = Array.from(portsContainer.querySelectorAll('.port'));
    const cur = existing.length;
    if (cur > count){
      const toRemove = existing.slice(count);
      toRemove.forEach(p => {
        for (let i = connections.length - 1; i >= 0; i--){
            if (connections[i].a === p || connections[i].b === p){
              removeConnectionByLine(connections[i].line);
            }
        }
        const wrap = p.parentElement; if (wrap && wrap.classList.contains('port-wrap')) wrap.remove(); else p.remove();
      });
    }
    if (cur < count){
      for (let i = cur; i < count; i++){
        const wrap = document.createElement('div');
        wrap.className = 'port-wrap';
        wrap.dataset.portIndex = i;
        const label = document.createElement('span');
        label.className = 'port-label';
        label.contentEditable = 'true';
        label.textContent = 'p' + (i+1);
        const p = document.createElement('div');
        p.className = 'port';
        p.dataset.portIndex = i;
        p.dataset.portName = label.textContent;
        label.addEventListener('input', () => { p.dataset.portName = label.textContent; });
        wrap.appendChild(label);
        wrap.appendChild(p);
        portsContainer.appendChild(wrap);
        makePortInteractive(p);
      }
    }
    const baseHeight = 44;
    const perPort = 22;
    const labelEl = node.querySelector('.label');
    const labelH = labelEl ? labelEl.offsetHeight : 0;
    const paddingVert = 12;
    const newHeight = Math.max(baseHeight, labelH + paddingVert + count * perPort);
    node.style.height = newHeight + 'px';

    const ports = Array.from(portsContainer.querySelectorAll('.port'));
    const available = Math.max(24, newHeight - labelH - paddingVert);
    const spacing = Math.max(6, Math.floor(available / Math.max(1, ports.length)));
    ports.forEach((p, idx) => {
      const wrap = p.parentElement;
      const wrapH = Math.max(18, perPort - 2);
      const desiredTop = Math.round(labelH + 6 + idx * spacing);
      const maxTop = newHeight - wrapH - 6;
      const minTop = labelH + 4;
      const top = Math.min(Math.max(desiredTop, minTop), maxTop);
      wrap.style.top = top + 'px';
      wrap.style.height = wrapH + 'px';
    });
    updateAllLines();
  }

  paletteItems.forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      const type = item.dataset.type;
      const parentRect = canvas.getBoundingClientRect();
      const x = e.clientX - parentRect.left - 55;
      const y = e.clientY - parentRect.top - 22;
      const node = createNode(type, Math.max(0, Math.min(canvas.clientWidth-110, x)), Math.max(0, Math.min(canvas.clientHeight-44, y)));
      node.style.opacity = '0.9';
      node.style.pointerEvents = 'none';

      function onMove(ev){
        const px = ev.clientX - parentRect.left - 55;
        const py = ev.clientY - parentRect.top - 22;
        node.style.left = px + 'px'; node.style.top = py + 'px';
      }

      function onUp(ev){
        window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
        node.style.pointerEvents = '';
        node.style.opacity = '1';
        const px = ev.clientX - parentRect.left - 55;
        const py = ev.clientY - parentRect.top - 22;
        node.style.left = Math.max(0, Math.min(canvas.clientWidth-110, px)) + 'px';
        node.style.top = Math.max(0, Math.min(canvas.clientHeight-44, py)) + 'px';
        selectNode(node);
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  });

  function deleteSelectedNode(){
    if (!selectedNode) return;
    const ports = Array.from(selectedNode.querySelectorAll('.port'));
    for (let i = connections.length - 1; i >= 0; i--){
      if (ports.includes(connections[i].a) || ports.includes(connections[i].b)){
        removeConnectionByLine(connections[i].line);
      }
    }
    selectedNode.remove(); selectedNode = null;
    selectNode(null);
  }

  deleteSelectedBtn.addEventListener('click', () => deleteSelectedNode());

  selectedNameInput.addEventListener('input', () => {
    if (!selectedNode) return;
    selectedNode.dataset.name = selectedNameInput.value;
    const label = selectedNode.querySelector('.label'); if (label) label.textContent = selectedNameInput.value;
  });
  selectedPortsInput.addEventListener('change', () => {
    if (!selectedNode) return;
    rebuildPorts(selectedNode, Number(selectedPortsInput.value));
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace'){
      if (selectedConnection){ e.preventDefault(); removeConnectionByLine(selectedConnection); return; }
      if (selectedNode){ e.preventDefault(); deleteSelectedNode(); return; }
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.target === canvas || e.target === svg){
      if (selectedNode){ selectedNode.classList.remove('selected'); selectedNode = null; }
      if (selectedConnection){ selectedConnection.classList.remove('selected-conn'); selectedConnection = null; }
      selectedNameInput.value = '';
      selectedPortsInput.value = '1';
    }
  });

  function removeConnectionsUsingPort(port){
    for (let i = connections.length - 1; i >= 0; i--){
      if (connections[i].a === port || connections[i].b === port){
        removeConnectionByLine(connections[i].line);
      }
    }
  }

  function removeConnectionsUsingNode(node){
    const ports = Array.from(node.querySelectorAll('.port'));
    ports.forEach(removeConnectionsUsingPort);
  }

  function removeConnectionByPortPair(p1, p2){
    for (let i = connections.length - 1; i >= 0; i--){
      const c = connections[i];
      if ((c.a === p1 && c.b === p2) || (c.a === p2 && c.b === p1)){
        removeConnectionByLine(c.line);
      }
    }
  }

  const ro = new ResizeObserver(() => { svg.setAttribute('width', canvas.clientWidth); svg.setAttribute('height', canvas.clientHeight); updateAllLines(); });
  ro.observe(canvas);

  svg.setAttribute('width', canvas.clientWidth); svg.setAttribute('height', canvas.clientHeight);

})();
