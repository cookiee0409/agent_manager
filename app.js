const defaultAgents = [
  {
    id: "planner",
    name: "전략 기획가",
    role: "요구사항 정리와 작업 분해",
    capability: "목표를 단계별 실행 계획으로 바꾸고 담당 에이전트를 추천합니다.",
    initials: "PL",
    color: "#385e90",
    status: "대기",
    location: "Briefing Suite",
    image: ""
  },
  {
    id: "researcher",
    name: "리서처",
    role: "시장 조사와 자료 검증",
    capability: "검색, 출처 비교, 사실 확인이 필요한 일을 맡깁니다.",
    initials: "RS",
    color: "#146b6f",
    status: "진행",
    location: "Research Desk",
    image: ""
  },
  {
    id: "builder",
    name: "빌더",
    role: "코드 작성과 자동화 구현",
    capability: "프로토타입, 스크립트, 반복 업무 자동화를 빠르게 구성합니다.",
    initials: "BD",
    color: "#617a64",
    status: "대기",
    location: "Build Desk",
    image: ""
  },
  {
    id: "reviewer",
    name: "리뷰어",
    role: "품질 점검과 리스크 확인",
    capability: "완성된 산출물의 결함, 누락, 보안 위험을 점검합니다.",
    initials: "RV",
    color: "#b86646",
    status: "대기",
    location: "Review Bay",
    image: ""
  },
  {
    id: "analyst",
    name: "데이터 분석가",
    role: "지표 분석과 요약 보고",
    capability: "표, 수치, 로그를 읽고 의사결정용 요약으로 바꿉니다.",
    initials: "DA",
    color: "#b88a35",
    status: "완료",
    location: "Data Desk",
    image: ""
  },
  {
    id: "operator",
    name: "오퍼레이터",
    role: "배포, 알림, 반복 운영",
    capability: "예약 작업, 알림, 배포 체크리스트처럼 운영 흐름을 관리합니다.",
    initials: "OP",
    color: "#775c9c",
    status: "진행",
    location: "Ops Wall",
    image: ""
  }
];

const defaultTasks = [
  {
    id: crypto.randomUUID(),
    agentId: "researcher",
    title: "AI 회의록 서비스 비교",
    detail: "주요 5개 서비스의 가격, 보안, 한국어 품질을 비교해 요약합니다.",
    priority: "높음",
    due: "",
    status: "진행"
  },
  {
    id: crypto.randomUUID(),
    agentId: "operator",
    title: "매일 오전 알림 설계",
    detail: "완료되지 않은 작업을 오전 9시에 요약하는 알림 흐름을 구성합니다.",
    priority: "보통",
    due: "",
    status: "대기"
  },
  {
    id: crypto.randomUUID(),
    agentId: "analyst",
    title: "지난주 작업 처리량 요약",
    detail: "에이전트별 완료 건수와 평균 처리 시간을 표로 정리합니다.",
    priority: "낮음",
    due: "",
    status: "완료"
  }
];

const storageKeys = {
  agents: "agent-office-agents",
  tasks: "agent-office-tasks",
  apiKeys: "agent-office-keys",
  records: "agent-office-records",
  progressLogs: "agent-office-progress-logs"
};

const statusColors = {
  "대기": "#b88a35",
  "진행": "#146b6f",
  "완료": "#617a64"
};

const providers = {
  auto: "자동 선택",
  google: "Google AI",
  anthropic: "Anthropic"
};

const workStateMeta = {
  queued: { label: "작업 대기", detail: "아직 실행 요청 전입니다.", color: "#b88a35" },
  processing: { label: "실제 처리 중", detail: "에이전트가 현재 작업을 처리 중입니다.", color: "#146b6f" },
  approval: { label: "승인 요청", detail: "사용자 승인이나 추가 입력을 기다립니다.", color: "#385e90" },
  error: { label: "오류로 중단", detail: "오류 확인 후 재시작이 필요합니다.", color: "#b44c43" },
  done: { label: "처리 완료", detail: "작업이 완료되었습니다.", color: "#617a64" },
  idle: { label: "호출 대기", detail: "현재 맡은 작업이 없습니다.", color: "#6f7976" }
};

let agents = ensureArray(loadJson(storageKeys.agents, defaultAgents), defaultAgents).map(normalizeAgent);
let tasks = ensureArray(loadJson(storageKeys.tasks, defaultTasks), defaultTasks).filter((task) =>
  taskAgentIds(task).some((agentId) => agents.some((agent) => agent.id === agentId))
);
let keyStore = normalizeKeyStore(loadSessionJson(storageKeys.apiKeys, {}));
localStorage.removeItem(storageKeys.apiKeys);
let records = ensureArray(loadJson(storageKeys.records, []), []);
let progressLogs = ensureArray(loadJson(storageKeys.progressLogs, []), []);
let selectedAgentId = agents[0]?.id || null;
let managedAgentId = selectedAgentId;
let currentFilter = "all";
let assetImages = [];
let providerStatus = { google: false, anthropic: false };

const els = {
  rosterList: document.querySelector("#roster-list"),
  deskGrid: document.querySelector("#desk-grid"),
  selectedAgent: document.querySelector("#selected-agent"),
  selectedAgentName: document.querySelector("#selected-agent-name"),
  assignTaskButton: document.querySelector("#assign-task"),
  taskList: document.querySelector("#task-list"),
  meetingMode: document.querySelector("#meeting-mode"),
  meetingAgentPicker: document.querySelector("#meeting-agent-picker"),
  meetingList: document.querySelector("#meeting-list"),
  meetingCount: document.querySelector("#meeting-count"),
  progressMonitorList: document.querySelector("#progress-monitor-list"),
  monitorLogCount: document.querySelector("#monitor-log-count"),
  apiModal: document.querySelector("#api-modal"),
  manageModal: document.querySelector("#manage-modal"),
  recordsModal: document.querySelector("#records-modal"),
  agentKeyList: document.querySelector("#agent-key-list"),
  bulkGoogleKey: document.querySelector("#bulk-google-key"),
  bulkAnthropicKey: document.querySelector("#bulk-anthropic-key"),
  googleStatus: document.querySelector("#google-status"),
  anthropicStatus: document.querySelector("#anthropic-status"),
  assignAllKeys: document.querySelector("#assign-all-keys"),
  recordList: document.querySelector("#record-list"),
  recordCount: document.querySelector("#record-count"),
  clearRecords: document.querySelector("#clear-records"),
  manageAgentList: document.querySelector("#manage-agent-list"),
  agentForm: document.querySelector("#agent-form"),
  hireAgent: document.querySelector("#hire-agent"),
  removeAgent: document.querySelector("#remove-agent"),
  formImagePreview: document.querySelector("#form-image-preview"),
  agentNameInput: document.querySelector("#agent-name-input"),
  agentInitialsInput: document.querySelector("#agent-initials-input"),
  agentRoleInput: document.querySelector("#agent-role-input"),
  agentCapabilityInput: document.querySelector("#agent-capability-input"),
  agentLocationInput: document.querySelector("#agent-location-input"),
  agentStatusInput: document.querySelector("#agent-status-input"),
  agentColorInput: document.querySelector("#agent-color-input"),
  agentImageInput: document.querySelector("#agent-image-input"),
  agentImageFile: document.querySelector("#agent-image-file"),
  pickAgentImage: document.querySelector("#pick-agent-image"),
  refreshAssets: document.querySelector("#refresh-assets"),
  assetGallery: document.querySelector("#asset-gallery")
};

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || cloneData(fallback);
  } catch {
    return cloneData(fallback);
  }
}

function loadSessionJson(key, fallback) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null") || cloneData(fallback);
  } catch {
    return cloneData(fallback);
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureArray(value, fallback) {
  return Array.isArray(value) ? value : cloneData(fallback);
}

function persistAgents() {
  localStorage.setItem(storageKeys.agents, JSON.stringify(agents));
}

function persistTasks() {
  localStorage.setItem(storageKeys.tasks, JSON.stringify(tasks));
}

function persistKeys() {
  sessionStorage.setItem(storageKeys.apiKeys, JSON.stringify(keyStore));
}

function persistRecords() {
  localStorage.setItem(storageKeys.records, JSON.stringify(records));
}

function persistProgressLogs() {
  localStorage.setItem(storageKeys.progressLogs, JSON.stringify(progressLogs));
}

function addProgressLog(agentIds, task, message, level = "info") {
  const ids = [...new Set(ensureArray(agentIds, []).filter((agentId) => getAgent(agentId)))];
  if (ids.length === 0) return;

  progressLogs = [
    {
      id: crypto.randomUUID(),
      agentIds: ids,
      taskId: task?.id || "",
      taskTitle: task?.title || "시스템 이벤트",
      message,
      level,
      createdAt: new Date().toISOString()
    },
    ...progressLogs
  ].slice(0, 300);
  persistProgressLogs();
}

function taskAgentIds(task) {
  if (Array.isArray(task.agentIds) && task.agentIds.length > 0) return task.agentIds;
  return task.agentId ? [task.agentId] : [];
}

function taskAgents(task) {
  return taskAgentIds(task)
    .map((agentId) => getAgent(agentId))
    .filter(Boolean);
}

function taskWorkState(task) {
  if (task.status === "완료") return "done";
  if (task.workState && workStateMeta[task.workState]) return task.workState;
  if (task.status === "진행") return "processing";
  return "queued";
}

function statusToWorkState(status) {
  if (status === "완료") return "done";
  if (status === "진행") return "processing";
  return "queued";
}

function isMeetingTask(task) {
  return task.meeting || taskAgentIds(task).length > 1;
}

function getAgentCondition(agent) {
  const activeTasks = getAgentTasks(agent.id);
  if (activeTasks.length === 0) return workStateMeta.idle;

  const statePriority = ["error", "approval", "processing", "queued"];
  const state = statePriority.find((item) => activeTasks.some((task) => taskWorkState(task) === item)) || "queued";
  const firstTask = activeTasks.find((task) => taskWorkState(task) === state) || activeTasks[0];
  return {
    ...workStateMeta[state],
    taskTitle: firstTask.title
  };
}

function addRecord(action, task, detail = "") {
  const relatedAgents = taskAgents(task).map((agent) => agent.name);
  const relatedAgentIds = taskAgentIds(task);
  records = [
    {
      id: crypto.randomUUID(),
      action,
      title: task.title || "제목 없는 작업",
      detail: detail || task.detail || "",
      agents: relatedAgents,
      status: task.status || "대기",
      createdAt: new Date().toISOString()
    },
    ...records
  ];
  persistRecords();
  addProgressLog(relatedAgentIds, task, `${action}: ${detail || task.detail || "상태가 갱신되었습니다."}`, action.includes("오류") ? "error" : action.includes("승인") ? "warn" : "info");
}

function normalizeAgent(agent) {
  return {
    id: agent.id || `agent-${Date.now()}`,
    name: agent.name || "새 에이전트",
    role: agent.role || "역할 미지정",
    capability: agent.capability || "아직 설정값이 없습니다.",
    initials: (agent.initials || agent.name || "AG").slice(0, 4).toUpperCase(),
    color: safeColor(agent.color),
    status: statusColors[agent.status] ? agent.status : "대기",
    location: agent.location || "Open Desk",
    image: agent.image || ""
  };
}

function safeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : "#146b6f";
}

function normalizeKeyStore(rawStore) {
  const source = rawStore && typeof rawStore === "object" ? rawStore : {};
  return Object.fromEntries(
    Object.entries(source).map(([agentId, value]) => {
      if (typeof value === "string") {
        return [agentId, { google: value, anthropic: "" }];
      }
      return [
        agentId,
        {
          google: value?.google || "",
          anthropic: value?.anthropic || ""
        }
      ];
    })
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeImageUrl(value) {
  return String(value || "").replace(/[\\'")]/g, "").trim();
}

function imageStyle(agent) {
  const image = safeImageUrl(agent.image);
  const color = safeColor(agent.color);
  return image
    ? `--agent-color:${color}; background-image:url('${escapeHtml(image)}')`
    : `--agent-color:${color}`;
}

function imageClass(agent) {
  return agent.image ? "agent-image has-image" : "agent-image";
}

function agentImage(agent) {
  return `<span class="${imageClass(agent)}" style="${imageStyle(agent)}">${escapeHtml(agent.initials)}</span>`;
}

function getAgent(agentId) {
  return agents.find((agent) => agent.id === agentId);
}

function getAgentTasks(agentId) {
  return tasks.filter((task) => taskAgentIds(task).includes(agentId) && task.status !== "완료");
}

function getStatus(agent) {
  const activeTasks = getAgentTasks(agent.id);
  if (activeTasks.some((task) => task.status === "진행")) return "진행";
  if (activeTasks.length > 0) return "대기";
  return agent.status === "완료" ? "완료" : "대기";
}

function getAgentKeys(agentId) {
  if (!keyStore[agentId]) keyStore[agentId] = { google: "", anthropic: "" };
  return keyStore[agentId];
}

function maskedProviderKey(agentId, provider) {
  const key = getAgentKeys(agentId)[provider];
  if (!key) return "미할당";
  if (key.length <= 8) return "저장됨";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function keySummary(agentId) {
  const google = providerStatus.google ? "G" : "-";
  const anthropic = providerStatus.anthropic ? "A" : "-";
  return `${google}/${anthropic}`;
}

function selectAgent(agentId) {
  if (!getAgent(agentId)) return;
  selectedAgentId = agentId;
  managedAgentId = agentId;
  render();
}

function renderRoster() {
  els.rosterList.innerHTML = agents
    .map((agent) => {
      const status = getStatus(agent);
      const condition = getAgentCondition(agent);
      const selected = agent.id === selectedAgentId ? " selected" : "";
      return `
        <button class="roster-item${selected}" type="button" data-agent-id="${escapeHtml(agent.id)}">
          ${agentImage(agent)}
          <span>
            <span class="agent-name">${escapeHtml(agent.name)}</span>
            <span class="agent-meta">${getAgentTasks(agent.id).length}건 배정 · 키 ${keySummary(agent.id)} · ${condition.label}</span>
          </span>
          <span class="status-dot" style="--status-color:${condition.color || statusColors[status]}"></span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".roster-item").forEach((button) => {
    button.addEventListener("click", () => selectAgent(button.dataset.agentId));
  });
}

function renderDesks() {
  els.deskGrid.innerHTML = agents
    .map((agent) => {
      const status = getStatus(agent);
      const activeTask = getAgentTasks(agent.id)[0];
      const condition = getAgentCondition(agent);
      const selected = agent.id === selectedAgentId ? " selected" : "";
      const hidden =
        currentFilter === "busy" && status !== "진행"
          ? " hidden"
          : currentFilter === "idle" && status === "진행"
            ? " hidden"
            : "";

      return `
        <button class="desk-card${selected}${hidden}" type="button" data-agent-id="${escapeHtml(agent.id)}" style="--agent-color:${safeColor(agent.color)}">
          <div class="desk-header">
            ${agentImage(agent)}
            <div>
              <h3 class="desk-title">${escapeHtml(agent.name)}</h3>
              <p class="desk-role">${escapeHtml(agent.role)}</p>
              <p class="desk-location">${escapeHtml(agent.location)}</p>
            </div>
          </div>
          <div class="desk-badges">
            <span class="badge" style="--status-color:${statusColors[status]}">${status}</span>
            <span class="badge soft" style="--status-color:${condition.color}">${condition.label}</span>
          </div>
          <div class="desk-task">
            <strong>${activeTask ? escapeHtml(activeTask.title) : "맡은 작업 없음"}</strong>
            <span>${activeTask ? escapeHtml(condition.detail) : "호출 가능한 상태입니다."}</span>
          </div>
          <div class="capability-chip">${escapeHtml(agent.capability)}</div>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".desk-card").forEach((button) => {
    button.addEventListener("click", () => selectAgent(button.dataset.agentId));
  });
}

function renderMeetingPicker() {
  els.meetingAgentPicker.hidden = !els.meetingMode.checked;
  if (!els.meetingMode.checked) return;

  els.meetingAgentPicker.innerHTML = agents
    .map((agent) => {
      const checked = agent.id === selectedAgentId ? " checked" : "";
      return `
        <label class="meeting-agent-option">
          <input type="checkbox" data-meeting-agent="${escapeHtml(agent.id)}"${checked}>
          <span>${escapeHtml(agent.name)}</span>
        </label>
      `;
    })
    .join("");
}

function renderMeetingRoom() {
  const meetingTasks = tasks.filter((task) => isMeetingTask(task) && task.status !== "완료");
  els.meetingCount.textContent = `${meetingTasks.length}건`;

  if (meetingTasks.length === 0) {
    els.meetingList.innerHTML = `<div class="empty-state">협업 작업 없음</div>`;
    return;
  }

  els.meetingList.innerHTML = meetingTasks
    .map((task) => {
      const names = taskAgents(task).map((agent) => agent.name).join(", ");
      return `
        <article class="meeting-card">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(names)}</span>
        </article>
      `;
    })
    .join("");
}

function renderSelectedAgent() {
  const agent = getAgent(selectedAgentId) || agents[0];
  if (!agent) {
    els.selectedAgent.innerHTML = `<div class="empty-state">에이전트를 고용해 주세요.</div>`;
    els.selectedAgentName.textContent = "에이전트 없음";
    els.assignTaskButton.disabled = true;
    return;
  }

  const status = getStatus(agent);
  const condition = getAgentCondition(agent);
  const assigned = tasks.filter((task) => taskAgentIds(task).includes(agent.id)).length;
  els.selectedAgentName.textContent = agent.name;

  els.selectedAgent.innerHTML = `
    <div class="selected-head">
      ${agentImage(agent)}
      <div>
        <h2>${escapeHtml(agent.name)}</h2>
        <p>${escapeHtml(agent.role)}</p>
      </div>
    </div>
    <div class="agent-stats">
      <div>
        <strong>${status}</strong>
        <p>현재 상태</p>
      </div>
      <div>
        <strong>${assigned}건</strong>
        <p>누적 할당</p>
      </div>
      <div>
        <strong>${keySummary(agent.id)}</strong>
        <p>API 키 G/A</p>
      </div>
      <div>
        <strong>${escapeHtml(agent.location)}</strong>
        <p>좌석</p>
      </div>
      <div class="wide-stat">
        <strong>${escapeHtml(condition.label)}</strong>
        <p>${escapeHtml(condition.taskTitle || condition.detail)}</p>
      </div>
    </div>
    <div class="agent-status-actions">
      <button type="button" data-agent-action="idle">대기</button>
      <button type="button" data-agent-action="start">진행 요청</button>
      <button type="button" data-agent-action="approval">승인 요청</button>
      <button type="button" data-agent-action="error">오류 중단</button>
    </div>
    ${renderAgentLogPanel(agent.id)}
  `;

  document.querySelectorAll("[data-agent-action]").forEach((button) => {
    button.addEventListener("click", () => updateAgentWorkState(agent.id, button.dataset.agentAction));
  });
}

function updateAgentWorkState(agentId, action) {
  const activeTask = getAgentTasks(agentId)[0];
  const agent = getAgent(agentId);
  if (!agent) return;

  if (!activeTask && action === "idle") {
    agents = agents.map((item) => (item.id === agentId ? { ...item, status: "대기" } : item));
    persistAgents();
    render();
    return;
  }

  if (!activeTask && action === "start") {
    const newTask = {
      id: crypto.randomUUID(),
      agentId,
      agentIds: [agentId],
      meeting: false,
      title: "즉시 진행 요청",
      detail: `${agent.name}에게 바로 진행을 요청했습니다.`,
      priority: "보통",
      provider: "auto",
      due: "",
      status: "진행",
      workState: "processing"
    };
    tasks = [newTask, ...tasks];
    addRecord("진행 요청", newTask, "상태창에서 즉시 진행 요청");
    persistTasks();
    render();
    runTaskExecution(newTask.id);
    return;
  }

  if (!activeTask) return;

  const nextByAction = {
    idle: { status: "대기", workState: "queued", record: "대기 전환" },
    start: { status: "진행", workState: "processing", record: "진행 요청" },
    approval: { status: "진행", workState: "approval", record: "승인 요청" },
    error: { status: "진행", workState: "error", record: "오류 중단" }
  };
  const next = nextByAction[action];
  if (!next) return;

  tasks = tasks.map((task) =>
    task.id === activeTask.id ? { ...task, status: next.status, workState: next.workState } : task
  );
  const updatedTask = tasks.find((task) => task.id === activeTask.id);
  addRecord(next.record, updatedTask, workStateMeta[next.workState].detail);
  persistTasks();
  render();
  if (action === "start") runTaskExecution(updatedTask.id);
}

async function runTaskExecution(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  const agentIds = taskAgentIds(task);
  tasks = tasks.map((item) =>
    item.id === taskId ? { ...item, status: "진행", workState: "processing" } : item
  );
  addProgressLog(agentIds, task, "실행 서버에 작업을 전송했습니다.", "info");
  persistTasks();
  render();

  const results = {};
  const errors = [];

  await Promise.all(
    taskAgents(task).map(async (agent) => {
      try {
        addProgressLog([agent.id], task, `${agent.name} 실행 시작`, "info");
        const response = await fetch("/api/run-agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: task.provider || "auto",
            task,
            agent
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || `실행 실패 (${response.status})`);
        results[agent.id] = data.output;
        addProgressLog([agent.id], task, `${data.provider}: ${data.output.slice(0, 220)}`, "info");
      } catch (error) {
        errors.push(`${agent.name}: ${error.message}`);
        addProgressLog([agent.id], task, error.message, "error");
      }
    })
  );

  const nextTask = tasks.find((item) => item.id === taskId);
  if (!nextTask) return;

  if (errors.length > 0) {
    tasks = tasks.map((item) =>
      item.id === taskId ? { ...item, status: "진행", workState: "error", results, error: errors.join("\n") } : item
    );
    addRecord("오류 중단", { ...nextTask, results }, errors.join("\n"));
  } else {
    tasks = tasks.map((item) =>
      item.id === taskId ? { ...item, status: "완료", workState: "done", results } : item
    );
    addRecord("처리 완료", { ...nextTask, results, status: "완료" }, "모든 에이전트 실행이 완료되었습니다.");
  }

  persistTasks();
  render();
}

function renderTasks() {
  document.querySelector("#task-count").textContent = `${tasks.length}건`;

  if (tasks.length === 0) {
    els.taskList.innerHTML = `<div class="empty-state">아직 할당된 작업이 없습니다.</div>`;
    return;
  }

  els.taskList.innerHTML = tasks
    .map((task) => {
      const relatedAgents = taskAgents(task);
      const agent = relatedAgents[0];
      if (!agent) return "";
      const due = task.due ? `마감 ${task.due}` : "마감 없음";
      const agentNames = relatedAgents.map((item) => item.name).join(", ");
      const taskType = isMeetingTask(task) ? "회의실 협업" : "개별 요청";
      const workState = taskWorkState(task);
      const workMeta = workStateMeta[workState];
      return `
        <article class="task-item" style="--agent-color:${safeColor(agent.color)}">
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.detail)}</p>
          <div class="task-meta">
            <span>${escapeHtml(taskType)}</span>
            <span>${escapeHtml(agentNames)}</span>
            <span>${escapeHtml(task.priority)}</span>
            <span>${escapeHtml(providers[task.provider] || providers.auto)}</span>
            <span>${escapeHtml(due)}</span>
            <span>${escapeHtml(task.status)}</span>
            <span>${escapeHtml(workMeta.label)}</span>
          </div>
          <div class="work-state-line" style="--status-color:${workMeta.color}">${escapeHtml(workMeta.detail)}</div>
          <div class="task-actions">
            <button type="button" data-task-id="${escapeHtml(task.id)}" data-next="대기">대기</button>
            <button type="button" data-task-id="${escapeHtml(task.id)}" data-next="진행">진행</button>
            <button type="button" data-task-id="${escapeHtml(task.id)}" data-next="완료">완료</button>
            <button type="button" data-task-id="${escapeHtml(task.id)}" data-work-state="approval">승인요청</button>
            <button type="button" data-task-id="${escapeHtml(task.id)}" data-work-state="error">오류중단</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const before = tasks.find((task) => task.id === button.dataset.taskId);
      tasks = tasks.map((task) =>
        task.id === button.dataset.taskId
          ? { ...task, status: button.dataset.next, workState: statusToWorkState(button.dataset.next) }
          : task
      );
      const after = tasks.find((task) => task.id === button.dataset.taskId);
      if (before && after && before.status !== after.status) {
        addRecord("상태 변경", after, `${before.status} → ${after.status}`);
      }
      persistTasks();
      render();
      if (button.dataset.next === "진행" && after) runTaskExecution(after.id);
    });
  });

  document.querySelectorAll("[data-work-state]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextState = button.dataset.workState;
      const before = tasks.find((task) => task.id === button.dataset.taskId);
      tasks = tasks.map((task) =>
        task.id === button.dataset.taskId ? { ...task, status: "진행", workState: nextState } : task
      );
      const after = tasks.find((task) => task.id === button.dataset.taskId);
      if (before && after) addRecord(workStateMeta[nextState].label, after, workStateMeta[nextState].detail);
      persistTasks();
      render();
    });
  });
}

function renderCounts() {
  const active = tasks.filter((task) => task.status === "진행").length;
  const queued = tasks.filter((task) => task.status === "대기").length;
  const done = tasks.filter((task) => task.status === "완료").length;
  const ready = agents.filter((agent) => getStatus(agent) !== "진행").length;

  document.querySelector("#active-count").textContent = active;
  document.querySelector("#queued-count").textContent = queued;
  document.querySelector("#done-count").textContent = done;
  document.querySelector("#online-count").textContent = `${ready}명 준비`;
}

function renderRecords() {
  els.recordCount.textContent = `${records.length}건 기록`;

  if (records.length === 0) {
    els.recordList.innerHTML = `<div class="empty-state">아직 기록된 작업이 없습니다.</div>`;
    return;
  }

  els.recordList.innerHTML = records
    .map((record) => {
      const date = new Date(record.createdAt).toLocaleString("ko-KR");
      const recordAgents = Array.isArray(record.agents) ? record.agents : [];
      const agentsText = recordAgents.length > 0 ? recordAgents.join(", ") : "담당자 없음";
      return `
        <article class="record-item">
          <div>
            <h3>${escapeHtml(record.title)}</h3>
            <p>${escapeHtml(record.detail)}</p>
            <div class="record-meta">
              <span>${escapeHtml(record.action)}</span>
              <span>${escapeHtml(record.status)}</span>
              <span>${escapeHtml(agentsText)}</span>
              <span>${escapeHtml(date)}</span>
            </div>
          </div>
          <button class="record-delete" type="button" data-record-id="${escapeHtml(record.id)}">삭제</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      records = records.filter((record) => record.id !== button.dataset.recordId);
      persistRecords();
      renderRecords();
    });
  });
}

function formatLogTime(value) {
  return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function logsForAgent(agentId, limit = 5) {
  return progressLogs
    .filter((log) => ensureArray(log.agentIds, []).includes(agentId))
    .slice(0, limit);
}

function renderAgentLogPanel(agentId) {
  const logs = logsForAgent(agentId, 5);
  if (logs.length === 0) {
    return `
      <section class="agent-log-panel">
        <div class="mini-panel-head">
          <span>진행상황 요약</span>
          <strong>0</strong>
        </div>
        <div class="mini-log-empty">아직 기록된 진행 로그가 없습니다.</div>
      </section>
    `;
  }

  return `
    <section class="agent-log-panel">
      <div class="mini-panel-head">
        <span>진행상황 요약</span>
        <strong>${logs.length}</strong>
      </div>
      <div class="mini-log-list">
        ${logs
          .map((log) => `
            <article class="mini-log-item ${escapeHtml(log.level || "info")}">
              <time>${escapeHtml(formatLogTime(log.createdAt))}</time>
              <div>
                <strong>${escapeHtml(log.taskTitle)}</strong>
                <p>${escapeHtml(log.message)}</p>
              </div>
            </article>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function renderProgressMonitor() {
  els.monitorLogCount.textContent = `${progressLogs.length} logs`;

  els.progressMonitorList.innerHTML = agents
    .map((agent) => {
      const condition = getAgentCondition(agent);
      const logs = logsForAgent(agent.id, 2);
      const activeTask = getAgentTasks(agent.id)[0];
      return `
        <article class="monitor-agent-row" style="--status-color:${condition.color}; --agent-color:${safeColor(agent.color)}">
          <div class="monitor-agent-head">
            <span class="monitor-dot"></span>
            <strong>${escapeHtml(agent.name)}</strong>
            <em>${escapeHtml(condition.label)}</em>
          </div>
          <p>${escapeHtml(activeTask ? activeTask.title : condition.detail)}</p>
          <div class="monitor-log-lines">
            ${
              logs.length > 0
                ? logs.map((log) => `<span>${escapeHtml(formatLogTime(log.createdAt))} · ${escapeHtml(log.message)}</span>`).join("")
                : `<span>최근 로그 없음</span>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadProviderStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const data = await response.json();
    providerStatus = {
      google: Boolean(data.providers?.google),
      anthropic: Boolean(data.providers?.anthropic)
    };
  } catch {
    providerStatus = { google: false, anthropic: false };
  }

  if (els.googleStatus) els.googleStatus.textContent = providerStatus.google ? "사용 가능" : "환경변수 없음";
  if (els.anthropicStatus) els.anthropicStatus.textContent = providerStatus.anthropic ? "사용 가능" : "환경변수 없음";
  renderRoster();
  renderSelectedAgent();
}

function renderKeyModal() {
  els.agentKeyList.innerHTML = agents
    .map((agent) => {
      const keys = getAgentKeys(agent.id);
      return `
      <div class="key-agent-row provider-key-row">
        ${agentImage(agent)}
        <div>
          <span class="agent-name">${escapeHtml(agent.name)}</span>
          <span class="agent-meta">Google ${maskedProviderKey(agent.id, "google")} · Anthropic ${maskedProviderKey(agent.id, "anthropic")}</span>
        </div>
        <input id="google-key-input-${escapeHtml(agent.id)}" type="password" autocomplete="off" placeholder="Google AI 키" value="${escapeHtml(keys.google)}">
        <input id="anthropic-key-input-${escapeHtml(agent.id)}" type="password" autocomplete="off" placeholder="Anthropic 키" value="${escapeHtml(keys.anthropic)}">
        <button type="button" data-key-agent="${escapeHtml(agent.id)}">저장</button>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll("[data-key-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      const agentId = button.dataset.keyAgent;
      const googleInput = document.getElementById(`google-key-input-${agentId}`);
      const anthropicInput = document.getElementById(`anthropic-key-input-${agentId}`);
      if (!googleInput || !anthropicInput) return;
      keyStore[agentId] = {
        google: googleInput.value.trim(),
        anthropic: anthropicInput.value.trim()
      };
      persistKeys();
      renderKeyModal();
      render();
    });
  });
}

function renderManageList() {
  els.manageAgentList.innerHTML = agents
    .map((agent) => {
      const selected = agent.id === managedAgentId ? " selected" : "";
      return `
        <button class="manage-agent-button${selected}" type="button" data-manage-agent="${escapeHtml(agent.id)}">
          ${agentImage(agent)}
          <span>
            <span class="agent-name">${escapeHtml(agent.name)}</span>
            <span class="agent-meta">${escapeHtml(agent.role)}</span>
          </span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-manage-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      managedAgentId = button.dataset.manageAgent;
      renderManageTools();
    });
  });
}

function renderAgentForm() {
  const agent = getAgent(managedAgentId) || agents[0];
  if (!agent) {
    els.agentForm.hidden = true;
    return;
  }

  els.agentForm.hidden = false;
  els.agentNameInput.value = agent.name;
  els.agentInitialsInput.value = agent.initials;
  els.agentRoleInput.value = agent.role;
  els.agentCapabilityInput.value = agent.capability;
  els.agentLocationInput.value = agent.location;
  els.agentStatusInput.value = agent.status;
  els.agentColorInput.value = safeColor(agent.color);
  els.agentImageInput.value = agent.image;
  updateImagePreview();
}

function updateImagePreview() {
  const image = safeImageUrl(els.agentImageInput.value);
  const color = safeColor(els.agentColorInput.value);
  const initials = els.agentInitialsInput.value.trim() || "AG";

  els.formImagePreview.className = image ? "image-preview has-image" : "image-preview";
  els.formImagePreview.style.setProperty("--agent-color", color);
  els.formImagePreview.style.backgroundImage = image ? `url('${image}')` : "";
  els.formImagePreview.textContent = initials.toUpperCase().slice(0, 4);
  renderAssetGallery();
}

async function loadAssetGallery() {
  const fromDirectory = await readAssetsDirectory();
  const fromManifest = fromDirectory.length > 0 ? [] : await readAssetsManifest();
  assetImages = [...new Set([...fromDirectory, ...fromManifest])];
  renderAssetGallery();
}

async function readAssetsDirectory() {
  try {
    const response = await fetch("./assets/");
    if (!response.ok) return [];
    const html = await response.text();
    return [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((href) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(href))
      .map((href) => new URL(href, new URL("./assets/", location.href)).pathname)
      .map((path) => `.${decodeURI(path.replace(location.pathname.replace(/\/[^/]*$/, "/"), "/"))}`)
      .map((path) => path.replace(/\/+/g, "/"));
  } catch {
    return [];
  }
}

async function readAssetsManifest() {
  try {
    const response = await fetch("./assets/manifest.json", { cache: "no-store" });
    if (!response.ok) return [];
    const list = await response.json();
    return ensureArray(list, [])
      .filter((item) => typeof item === "string")
      .map((item) => item.startsWith("./") ? item : `./assets/${item.replace(/^assets\//, "")}`)
      .filter((item) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(item));
  } catch {
    return [];
  }
}

function renderAssetGallery() {
  if (!els.assetGallery) return;
  const selectedImage = els.agentImageInput.value.trim();

  if (assetImages.length === 0) {
    els.assetGallery.innerHTML = `<div class="empty-state">assets 폴더의 이미지를 찾지 못했습니다.</div>`;
    return;
  }

  els.assetGallery.innerHTML = assetImages
    .map((image) => {
      const selected = image === selectedImage ? " selected" : "";
      const name = image.split("/").pop();
      return `
        <button class="asset-tile${selected}" type="button" data-asset-image="${escapeHtml(image)}" title="${escapeHtml(name)}">
          <span style="background-image:url('${escapeHtml(image)}')"></span>
          <strong>${escapeHtml(name)}</strong>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-asset-image]").forEach((button) => {
    button.addEventListener("click", () => {
      els.agentImageInput.value = button.dataset.assetImage;
      updateImagePreview();
    });
  });
}

function renderManageTools() {
  renderManageList();
  renderAgentForm();
}

function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModals() {
  els.apiModal.hidden = true;
  els.manageModal.hidden = true;
  els.recordsModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function render() {
  if (!getAgent(selectedAgentId)) selectedAgentId = agents[0]?.id || null;
  renderCounts();
  renderRoster();
  renderDesks();
  renderMeetingPicker();
  renderMeetingRoom();
  renderProgressMonitor();
  renderSelectedAgent();
  renderTasks();
  els.assignTaskButton.disabled = !selectedAgentId;
}

document.querySelector("#open-key-modal").addEventListener("click", () => {
  els.bulkGoogleKey.value = "";
  els.bulkAnthropicKey.value = "";
  renderKeyModal();
  loadProviderStatus();
  openModal(els.apiModal);
});

document.querySelector("#open-manage-modal").addEventListener("click", () => {
  managedAgentId = selectedAgentId || agents[0]?.id || null;
  renderManageTools();
  loadAssetGallery();
  openModal(els.manageModal);
});

document.querySelector("#open-records-modal").addEventListener("click", () => {
  renderRecords();
  openModal(els.recordsModal);
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModals);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModals();
});

els.assignAllKeys.addEventListener("click", () => {
  const google = els.bulkGoogleKey.value.trim();
  const anthropic = els.bulkAnthropicKey.value.trim();
  if (!google && !anthropic) return;
  agents.forEach((agent) => {
    const keys = getAgentKeys(agent.id);
    keyStore[agent.id] = {
      google: google || keys.google,
      anthropic: anthropic || keys.anthropic
    };
  });
  persistKeys();
  els.bulkGoogleKey.value = "";
  els.bulkAnthropicKey.value = "";
  renderKeyModal();
  render();
});

els.clearRecords.addEventListener("click", () => {
  records = [];
  persistRecords();
  renderRecords();
});

els.hireAgent.addEventListener("click", () => {
  const id = `agent-${Date.now()}`;
  const newAgent = normalizeAgent({
    id,
    name: "새 에이전트",
    role: "역할을 입력하세요",
    capability: "이 에이전트에게 맡길 업무 기준을 입력하세요.",
    initials: "AG",
    color: "#146b6f",
    status: "대기",
    location: "Open Desk",
    image: ""
  });

  agents = [newAgent, ...agents];
  selectedAgentId = id;
  managedAgentId = id;
  persistAgents();
  renderManageTools();
  render();
});

els.agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const agent = getAgent(managedAgentId);
  if (!agent) return;

  const updatedAgent = normalizeAgent({
    ...agent,
    name: els.agentNameInput.value.trim(),
    initials: els.agentInitialsInput.value.trim(),
    role: els.agentRoleInput.value.trim(),
    capability: els.agentCapabilityInput.value.trim(),
    location: els.agentLocationInput.value.trim(),
    status: els.agentStatusInput.value,
    color: els.agentColorInput.value,
    image: els.agentImageInput.value.trim()
  });

  agents = agents.map((item) => (item.id === managedAgentId ? updatedAgent : item));
  selectedAgentId = updatedAgent.id;
  managedAgentId = updatedAgent.id;
  persistAgents();
  renderManageTools();
  render();
});

els.removeAgent.addEventListener("click", () => {
  if (agents.length <= 1 || !managedAgentId) return;
  agents = agents.filter((agent) => agent.id !== managedAgentId);
  tasks = tasks
    .map((task) => ({
      ...task,
      agentIds: taskAgentIds(task).filter((agentId) => agentId !== managedAgentId)
    }))
    .filter((task) => task.agentIds.length > 0);
  delete keyStore[managedAgentId];
  selectedAgentId = agents[0]?.id || null;
  managedAgentId = selectedAgentId;
  persistAgents();
  persistTasks();
  persistKeys();
  renderManageTools();
  render();
});

[
  els.agentImageInput,
  els.agentColorInput,
  els.agentInitialsInput
].forEach((input) => {
  input.addEventListener("input", updateImagePreview);
});

els.pickAgentImage.addEventListener("click", () => {
  els.agentImageFile.click();
});

els.refreshAssets.addEventListener("click", loadAssetGallery);

els.agentImageFile.addEventListener("change", () => {
  const file = els.agentImageFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    els.agentImageInput.value = reader.result;
    updateImagePreview();
  });
  reader.readAsDataURL(file);
});

els.meetingMode.addEventListener("change", renderMeetingPicker);

els.assignTaskButton.addEventListener("click", () => {
  const title = document.querySelector("#task-title").value.trim();
  const detail = document.querySelector("#task-detail").value.trim();
  const priority = document.querySelector("#task-priority").value;
  const provider = document.querySelector("#task-provider").value;
  const due = document.querySelector("#task-due").value;

  if (!title || !detail || !selectedAgentId) return;

  const meetingAgentIds = [...document.querySelectorAll("[data-meeting-agent]:checked")]
    .map((input) => input.dataset.meetingAgent)
    .filter((agentId) => getAgent(agentId));
  const assignedAgentIds = els.meetingMode.checked
    ? [...new Set(meetingAgentIds.length > 0 ? meetingAgentIds : [selectedAgentId])]
    : [selectedAgentId];

  if (els.meetingMode.checked && assignedAgentIds.length < 2) return;

  const newTask = {
    id: crypto.randomUUID(),
    agentId: assignedAgentIds[0],
    agentIds: assignedAgentIds,
    meeting: assignedAgentIds.length > 1,
    title,
    detail,
    priority,
    provider,
    due,
    status: "대기",
    workState: "queued"
  };

  tasks = [
    newTask,
    ...tasks
  ];

  addRecord(newTask.meeting ? "회의실 협업 요청" : "작업 요청", newTask);
  persistTasks();
  document.querySelector("#task-title").value = "";
  document.querySelector("#task-detail").value = "";
  document.querySelector("#task-due").value = "";
  render();
  runTaskExecution(newTask.id);
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderDesks();
  });
});

render();
loadProviderStatus();
