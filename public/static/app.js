const lessons = [
  {
    page: 6, title: "Meet vim: your terminal text editor", subtitle: "Open, edit, save, and quit a file.",
    intro: "Vim opens right inside your terminal. Start by inspecting a file with cat, then open it in vim to practice editing. Vim has modes: Normal for moving around, Insert for typing, and a command line for saving or quitting.",
    example: [["cat notes.txt", "Take a look before you edit."], ["vim notes.txt", "Open the file in the practice editor."], ["i  →  type something  →  Esc", "Enter Insert mode, make a change, return to Normal mode."], [":w  ·  :q  ·  :wq", "Save · quit · save and quit."]],
    tag: "VIM BASICS"
  },
  {
    page: 7, title: "Know where you are.", subtitle: "pwd · cd · touch",
    intro: "A few tiny commands make a new place feel familiar. Print your working directory, move between folders, and create an empty file to work with.",
    example: [["pwd", "Print the folder you’re in."], ["cd notes   ·   cd ..   ·   cd ~", "Move into a folder · go up one level · return home."], ["touch journal.txt", "Create a new, empty file."], ["cd /home/student", "Jump to an absolute path."]],
    tag: "NAVIGATING & CREATING"
  },
  {
    page: 8, title: "Read a file with cat.", subtitle: "Print a file’s contents right to the terminal.",
    intro: "The cat command is a quick way to see what’s inside a text file. It doesn’t change the file; it just prints its contents so you can read them.",
    example: [["cat welcome.txt", "Print the whole file."], ["cat welcome.txt notes.txt", "Print files one after another."], ["touch journal.txt", "Make a file, then open it with vim to add some text."], ["cat journal.txt", "Read your saved work back."]],
    tag: "READING FILES"
  },
  {
    page: 9, title: "Find the line you need.", subtitle: "grep searches text inside files.",
    intro: "Give grep a word or phrase and a file, and it prints the matching lines. Search is case-sensitive by default, so the exact capitalization matters.",
    example: [["grep hello welcome.txt", "Show lines containing “hello”."], ["grep -n hello welcome.txt", "Include line numbers in the results."], ["grep -i HELLO welcome.txt", "Ignore uppercase and lowercase."], ["grep missing welcome.txt", "No matches? The practice terminal tells you." ]],
    tag: "SEARCHING · 1 OF 2"
  },
  {
    page: 10, title: "Search a little smarter.", subtitle: "Combine grep with files and folders.",
    intro: "You can search for a phrase, check a different file, or look through files with a filename pattern. Add quotes around a phrase that contains spaces.",
    example: [["grep \"good morning\" notes.txt", "Search for a phrase with spaces."], ["grep todo *.txt", "Search matching text files in this folder."], ["grep -n -i shell guide.txt", "Combine line numbers and case-insensitive search."], ["grep -r hello notes", "Search through a folder and its subfolders."]],
    tag: "SEARCHING · 2 OF 2"
  },
  {
    page: 11, title: "Challenge time: make it happen.", subtitle: "A mini mission, then hands-on practice.",
    intro: "Your mission: create a folder called field-notes, make a file inside it, add a line in vim, and use grep to find one word you wrote. Then copy the file and give the copy a new name.",
    example: [["mkdir field-notes && cd field-notes", "Create your workspace and step inside."], ["touch trail.txt && vim trail.txt", "Create a file and write a line in Insert mode."], ["grep trail trail.txt", "Write “trail” in your note, then find it."], ["cp trail.txt backup.txt", "Copy your finished note."]],
    tag: "CHALLENGE → HANDS-ON"
  },
  {
    page: 12, title: "You’re off to the races.", subtitle: "Thanks for learning with Shell Yeah!",
    intro: "You’ve navigated folders, made and moved files, read text, searched for clues, and tried vim. Keep the cheatsheet close and come back whenever you need a reminder.",
    example: [["pwd", "You know where you are."], ["grep line welcome.txt", "You know how to look for what matters."], ["echo \"see you around!\"", "There’s always another command to learn."], ["", "Thanks for showing up and giving it a go."]],
    tag: "THAT’S A WRAP"
  }
];

const lessonList = document.querySelector("#lesson-list");
const lessonCard = document.querySelector("#lesson-card");
let activeLesson = 0;

function renderLesson(index) {
  activeLesson = (index + lessons.length) % lessons.length;
  const lesson = lessons[activeLesson];
  lessonList.innerHTML = lessons.map((item, i) => `
    <button class="lesson-button ${i === activeLesson ? "active" : ""}" type="button" data-lesson="${i}" aria-pressed="${i === activeLesson}">
      <span class="lesson-number">${String(item.page).padStart(2, "0")}</span>
      <span><strong>${item.title.split(":")[0]}</strong><small>${item.subtitle}</small></span>
    </button>`).join("");
  lessonCard.innerHTML = `
    <div class="lesson-card-top"><span>PAGE ${lesson.page} / 12</span><span>${lesson.tag}</span></div>
    <h3>${lesson.title}</h3>
    <p>${lesson.intro}</p>
    <div class="lesson-example">${lesson.example.map(([cmd, desc]) => `<div>${cmd ? `<code>${escapeHtml(cmd)}</code>` : "<code>✳</code>"}<span>${escapeHtml(desc)}</span></div>`).join("")}</div>
    <div class="lesson-card-foot"><span>LESSON ${activeLesson + 1} OF ${lessons.length}</span><button type="button" id="next-lesson">${activeLesson === lessons.length - 1 ? "Back to the start ↑" : "Next lesson →"}</button></div>`;
  lessonList.querySelectorAll("[data-lesson]").forEach(button => {
    button.addEventListener("click", () => renderLesson(Number(button.dataset.lesson)));
  });
  document.querySelector("#next-lesson").addEventListener("click", () => renderLesson(activeLesson + 1));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

renderLesson(0);

const output = document.querySelector("#terminal-output");
const input = document.querySelector("#terminal-input");
const form = document.querySelector("#terminal-form");
const promptPath = document.querySelector(".shell-prompt");
const initialPath = "/home/student";
let cwd = initialPath;
let previousCwd = initialPath;
let history = [];
let historyIndex = 0;
let files;
let directories;
let editor = null;
let commandCapture = null;
const taskDefinitions = [
  { id: "file-workflow", points: 10, label: "touch newfile.txt, mkdir destination, and copy or move test.txt into it" },
  { id: "case-insensitive-search", points: 20, label: "cd destination and find hello in test.txt with grep -i" },
  { id: "edit-file", points: 20, label: "Save #hello in the file editme" }
];
let taskSteps = { touchedFile: false, madeDirectory: false, placedTest: false, visitedDestination: false };
let taskProgress = { "file-workflow": false, "case-insensitive-search": false, "edit-file": false };
let completedTasks = new Set();
let awardsInFlight = new Set();
let player = null;

function resetFilesystem() {
  cwd = initialPath;
  previousCwd = initialPath;
  files = new Map([
    ["/home/student/welcome.txt", "hello from your practice terminal!\nTry grep hello welcome.txt to find this line.\nYou can edit this file with vim."],
    ["/home/student/notes.txt", "remember to practice\nsmall steps make progress\nhello, terminal!\ngood morning, practice time."],
    ["/home/student/ideas.txt", "learn the command line\nmake a tiny project\nsearch for good ideas"],
    ["/home/student/guide.txt", "shell basics\ntry a small todo list\npractice every day"],
    ["/home/student/test.txt", "HELLO from the practice file.\nSearch with grep -i hello test.txt."],
    ["/home/student/notes/field.txt", "hello from the notes folder\nsave your good ideas"]
  ]);
  directories = new Set(["/", "/home", initialPath, `${initialPath}/notes`]);
  taskSteps = { touchedFile: false, madeDirectory: false, placedTest: false, visitedDestination: false };
  taskProgress = { "file-workflow": false, "case-insensitive-search": false, "edit-file": false };
}

function normalize(path) {
  const parts = path.startsWith("/") ? [] : cwd.split("/").filter(Boolean);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function resolve(path) {
  if (path === "~") return initialPath;
  if (path.startsWith("~/")) return normalize(`${initialPath}/${path.slice(2)}`);
  return normalize(path);
}

function basename(path) { return path.split("/").filter(Boolean).pop() || "/"; }
function parent(path) { const i = path.lastIndexOf("/"); return i <= 0 ? "/" : path.slice(0, i); }

function printLine(text = "", kind = "output-line") {
  if (commandCapture) {
    commandCapture.push({ text: String(text), kind });
    return;
  }
  const line = document.createElement("div");
  line.className = `terminal-line ${kind}`;
  line.textContent = text;
  output.append(line);
  output.scrollTop = output.scrollHeight;
}

function renderScoreboard() {
  document.querySelector("#player-points").textContent = String(player?.points ?? 0);
  document.querySelector("#player-status").textContent = player
    ? `Logged in as ${player.name} (${player.phone}).`
    : 'Run login <phone> "<name>" in the terminal to save your score.';
  document.querySelector("#task-list").innerHTML = taskDefinitions.map(task => {
    const complete = completedTasks.has(task.id);
    const inProgress = !complete && taskProgress[task.id];
    return `<li class="${complete ? "task-complete" : inProgress ? "task-progress" : ""}">
      <span>${complete ? "✓" : inProgress ? "…" : "○"}</span>
      <span>${escapeHtml(task.label)}</span>
      <strong>${task.points} pts</strong>
    </li>`;
  }).join("");
}

async function postApi(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

async function syncPendingAwards() {
  if (!player) return;
  const phone = player.phone;
  for (const task of taskDefinitions) {
    const requestId = `${phone}:${task.id}`;
    if (!taskProgress[task.id] || completedTasks.has(task.id) || awardsInFlight.has(requestId)) continue;
    awardsInFlight.add(requestId);
    try {
      const result = await postApi("/api/award", { phone, task: task.id });
      if (player?.phone !== phone) continue;
      player.points = result.points;
      completedTasks = new Set(result.achievements);
      renderScoreboard();
      printLine(result.awarded
        ? `Task complete: +${task.points} points (${player.points} total).`
        : `Task already recorded (${player.points} total).`);
    } catch (error) {
      if (player?.phone === phone) {
        printLine(`Could not save your points: ${error.message}`, "error-line");
      }
    } finally {
      awardsInFlight.delete(requestId);
    }
  }
}

async function loginPlayer(phone, name) {
  try {
    const result = await postApi("/api/login", { phone, name });
    player = { phone: result.phone, name: result.name, points: result.points };
    completedTasks = new Set(result.achievements);
    renderScoreboard();
    printLine(`Logged in as ${player.name}. Current score: ${player.points} points.`);
    await syncPendingAwards();
  } catch (error) {
    printLine(`Login failed: ${error.message}`, "error-line");
  }
}

function checkTaskProgress() {
  taskProgress["file-workflow"] =
    taskSteps.touchedFile && taskSteps.madeDirectory && taskSteps.placedTest;
  renderScoreboard();
  void syncPendingAwards();
}

function printPrompt(command) {
  const line = document.createElement("div");
  line.className = "terminal-line";
  const prompt = document.createElement("span");
  prompt.className = "line-prompt";
  prompt.textContent = `${cwd.replace(initialPath, "~") || "/"} $ `;
  const text = document.createElement("span");
  text.className = "line-command";
  text.textContent = command;
  line.append(prompt, text);
  output.append(line);
}

function tokenize(command) {
  return command.match(/"([^"]*)"|'([^']*)'|[^\s]+/g)?.map(token => token.replace(/^["']|["']$/g, "")) ?? [];
}

function ensureParent(path) {
  if (!directories.has(parent(path))) {
    printLine(`No such directory: ${parent(path)}`, "error-line");
    return false;
  }
  return true;
}

function listMatchingFiles(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  const regex = new RegExp(`^${escaped}$`);
  const dir = parent(resolve(pattern));
  const name = basename(pattern);
  return [...files.keys()].filter(file => parent(file) === dir && regex.test(basename(file)) && name.includes("*"));
}

function runCommandPart(command, stdinLines = null) {
  const args = tokenize(command);
  const cmd = args.shift();
  if (!cmd) return false;
  const argPath = arg => resolve(arg ?? "");
  const exists = path => files.has(path) || directories.has(path);
  let success = true;

  switch (cmd) {
    case "help":
      printLine("Commands: login, pwd, cd, mkdir, touch, cat, cp, mv, grep, vim, ls, echo, history, clear, help");
      printLine("Shell operators: | pipe, && on success, || on failure, & background");
      printLine("Shortcuts: ll (ls -la), ↑/↓ history, Tab complete, Ctrl+L clear");
      printLine("Try: mkdir -p projects/demo && cd projects/demo");
      printLine('Sign in to save points: login +15551234567 "Ada Lovelace"');
      break;
    case "login": {
      if (args.length < 2) {
        printLine('Usage: login PHONE "YOUR NAME"', "error-line");
        success = false;
      } else {
        void loginPlayer(args[0], args.slice(1).join(" "));
      }
      break;
    }
    case "pwd": printLine(cwd); break;
    case "cd": {
      const target = args[0] === "-" ? previousCwd : args[0] ? argPath(args[0]) : initialPath;
      if (!directories.has(target)) { printLine(`cd: no such directory: ${args[0] ?? "~"}`, "error-line"); success = false; }
      else {
        previousCwd = cwd;
        cwd = target;
        if (cwd === `${initialPath}/destination`) taskSteps.visitedDestination = true;
        if (args[0] === "-") printLine(cwd);
      }
      break;
    }
    case "mkdir": {
      const createParents = args[0] === "-p";
      if (createParents) args.shift();
      if (!args.length) { printLine("mkdir: please provide a folder name", "error-line"); break; }
      for (const name of args) {
        const path = argPath(name);
        if (directories.has(path) && createParents) continue;
        if (exists(path)) { printLine(`mkdir: already exists: ${name}`, "error-line"); success = false; }
        else if (createParents) {
          const parts = path.split("/").filter(Boolean);
          let current = "";
          for (const part of parts) {
            current += `/${part}`;
            if (files.has(current)) {
              printLine(`mkdir: cannot create directory: ${current} is a file`, "error-line");
              success = false;
              break;
            }
            directories.add(current);
          }
        } else if (ensureParent(path)) directories.add(path);
        else success = false;
      }
      if (success && args.some(name => argPath(name) === `${initialPath}/destination`)) {
        taskSteps.madeDirectory = true;
      }
      break;
    }
    case "touch": {
      if (!args.length) {
        if (stdinLines) stdinLines.forEach(line => printLine(line));
        else { printLine("touch: please provide a file name", "error-line"); success = false; }
        break;
      }
      for (const name of args) {
        const path = argPath(name);
        if (directories.has(path)) { printLine(`touch: is a directory: ${name}`, "error-line"); success = false; }
        else if (ensureParent(path) && !files.has(path)) files.set(path, "");
        else if (!directories.has(parent(path))) success = false;
      }
      if (success && args.some(name => argPath(name) === `${initialPath}/newfile.txt`)) {
        taskSteps.touchedFile = true;
      }
      break;
    }
    case "cat": {
      if (!args.length) {
        if (stdinLines) stdinLines.forEach(line => printLine(line));
        else { printLine("cat: please provide a file name", "error-line"); success = false; }
        break;
      }
      for (const name of args) {
        const path = argPath(name);
        if (files.has(path)) printLine(files.get(path));
        else { printLine(`cat: no such file: ${name}`, "error-line"); success = false; }
      }
      break;
    }
    case "ll":
    case "ls": {
      const expandedArgs = cmd === "ll" ? ["-la", ...args] : args;
      const flags = expandedArgs.filter(arg => arg.startsWith("-"));
      const showAll = flags.some(flag => flag.includes("a"));
      const longFormat = flags.some(flag => flag.includes("l"));
      const targetArg = expandedArgs.find(arg => !arg.startsWith("-"));
      const target = argPath(targetArg ?? ".");
      if (!directories.has(target)) { printLine(`ls: no such directory: ${args[0]}`, "error-line"); success = false; break; }
      const entries = [
        ...[...directories].filter(path => path !== target && parent(path) === target).map(basename),
        ...[...files.keys()].filter(path => parent(path) === target).map(basename)
      ].filter(name => showAll || !name.startsWith("."));
      if (showAll) entries.push(".", "..");
      const sorted = entries.sort();
      printLine(sorted.length
        ? longFormat
          ? `total ${sorted.length}\n${sorted.map(name => `${directories.has(`${target}/${name}`) ? "drwxr-xr-x" : "-rw-r--r--"}  student  student  ${files.get(`${target}/${name}`)?.length ?? 4096}  ${name}`).join("\n")}`
          : sorted.join("    ")
        : "(empty)");
      break;
    }
    case "history":
      history.forEach((entry, index) => printLine(`${String(index + 1).padStart(4)}  ${entry}`));
      break;
    case "cp":
    case "mv": {
      if (args.length !== 2) { printLine(`${cmd}: usage: ${cmd} SOURCE DEST`, "error-line"); success = false; break; }
      const source = argPath(args[0]);
      let destination = argPath(args[1]);
      if (!files.has(source)) { printLine(`${cmd}: no such file: ${args[0]}`, "error-line"); success = false; break; }
      if (directories.has(destination)) destination = `${destination}/${basename(source)}`;
      if (!ensureParent(destination)) { success = false; break; }
      files.set(destination, files.get(source));
      if (cmd === "mv" && source !== destination) files.delete(source);
      if (source === `${initialPath}/test.txt` && destination === `${initialPath}/destination/test.txt`) {
        taskSteps.placedTest = true;
      }
      break;
    }
    case "grep": {
      let lineNumbers = false;
      let ignoreCase = false;
      let recursive = false;
      while (args[0]?.startsWith("-")) {
        const flag = args.shift();
        if (flag.includes("n")) lineNumbers = true;
        if (flag.includes("i")) ignoreCase = true;
        if (flag.includes("r")) recursive = true;
      }
      const needle = args.shift();
      const target = args.shift();
      if (!needle || (!target && !stdinLines)) { printLine("grep: usage: grep [-inr] PATTERN [FILE]", "error-line"); success = false; break; }
      const targetPath = target ? argPath(target) : null;
      const paths = stdinLines ? [] : recursive && directories.has(targetPath)
        ? [...files.keys()].filter(path => path.startsWith(`${targetPath}/`))
        : target.includes("*") ? listMatchingFiles(target) : [targetPath];
      const matcher = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "i" : "");
      let found = false;
      const sources = stdinLines
        ? [{ name: null, text: stdinLines.join("\n") }]
        : paths.filter(path => files.has(path)).map(path => ({ name: path, text: files.get(path) }));
      for (const source of sources) {
        source.text.split("\n").forEach((line, index) => {
          if (matcher.test(line)) {
            found = true;
            const relativePath = source.name?.startsWith(`${targetPath}/`) ? source.name.slice(targetPath.length + 1) : basename(source.name ?? "");
            printLine(`${source.name && (recursive || paths.length > 1) ? `${relativePath}:` : ""}${lineNumbers ? `${index + 1}:` : ""}${line}`);
          }
        });
      }
      if (!stdinLines && (!paths.length || (!recursive && !target.includes("*") && !files.has(targetPath)))) {
        printLine(`grep: no such file: ${target}`, "error-line");
        success = false;
      } else if (!found) {
        printLine("(no matches)");
        success = false;
      }
      if (
        found &&
        ignoreCase &&
        needle.toLowerCase() === "hello" &&
        targetPath &&
        targetPath === `${initialPath}/destination/test.txt` &&
        taskSteps.placedTest &&
        taskSteps.visitedDestination &&
        cwd === `${initialPath}/destination`
      ) {
        taskProgress["case-insensitive-search"] = true;
      }
      break;
    }
    case "vim": {
      if (args.length !== 1) { printLine("vim: usage: vim FILE", "error-line"); success = false; break; }
      const path = argPath(args[0]);
      if (directories.has(path)) { printLine(`vim: is a directory: ${args[0]}`, "error-line"); success = false; break; }
      if (!ensureParent(path)) { success = false; break; }
      if (!files.has(path)) files.set(path, "");
      openEditor(path);
      break;
    }
    case "clear": output.innerHTML = ""; break;
    case "echo": printLine(args.join(" ")); break;
    default: printLine(`${cmd}: command not found. Type help to see practice commands.`, "error-line"); success = false;
  }
  checkTaskProgress();
  return success;
}

function splitShellOperators(command) {
  const parts = [];
  let current = "";
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if ((char === '"' || char === "'") && (!quote || quote === char)) quote = quote ? null : char;
    if (!quote && (char === "|" || char === "&")) {
      parts.push(current.trim());
      const doubled = command[index + 1] === char;
      parts.push(doubled ? char + char : char);
      current = "";
      if (doubled) index += 1;
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function executePipeline(commands) {
  let stdinLines = null;
  let lastResult = { success: true, output: [] };
  for (let index = 0; index < commands.length; index += 1) {
    const capture = [];
    commandCapture = capture;
    const success = runCommandPart(commands[index], stdinLines);
    commandCapture = null;
    const stdout = capture.filter(line => line.kind !== "error-line");
    const stderr = capture.filter(line => line.kind === "error-line");
    stderr.forEach(line => printLine(line.text, line.kind));
    stdinLines = stdout.flatMap(line => line.text.split("\n"));
    lastResult = { success, output: stdout };
  }
  lastResult.output.forEach(line => printLine(line.text, line.kind));
  return lastResult.success;
}

function runCommand(command) {
  const trimmed = command.trim();
  if (!trimmed) return;
  printPrompt(trimmed);
  const parts = splitShellOperators(trimmed);
  if (parts.at(-1) === "" && parts.at(-2) === "&") parts.splice(-1);
  if (parts.some((part, index) => index % 2 === 0 && !part)) {
    printLine("syntax error: missing command around shell operator", "error-line");
    return;
  }
  let previousStatus = true;
  let nextConnector = null;
  let index = 0;
  while (index < parts.length) {
    const pipeline = [parts[index]];
    index += 1;
    while (parts[index] === "|") {
      pipeline.push(parts[index + 1]);
      index += 2;
    }
    const separator = parts[index];
    if (separator === "&") {
      const job = history.length;
      printLine(`[${job}] started in the practice terminal`);
      setTimeout(() => {
        executePipeline(pipeline);
        printLine(`[${job}] done`);
      }, 0);
      previousStatus = true;
    } else {
      const shouldRun = nextConnector === "&&"
        ? previousStatus
        : nextConnector === "||" ? !previousStatus : true;
      if (shouldRun) previousStatus = executePipeline(pipeline);
    }
    nextConnector = separator === "&&" || separator === "||" ? separator : null;
    if (separator) index += 1;
  }
  promptPath.textContent = cwd.replace(initialPath, "~");
}

function openEditor(path) {
  editor = { path, mode: "NORMAL" };
  const wrapper = document.createElement("div");
  wrapper.className = "vim-editor";
  wrapper.innerHTML = `<div class="vim-editor-top"><span>${escapeHtml(basename(path))}</span><span class="vim-status">NORMAL</span></div>
    <textarea aria-label="Vim practice editor" spellcheck="false"></textarea>
    <div class="vim-controls"><button type="button" data-mode="INSERT">i&nbsp; insert</button><button type="button" data-mode="NORMAL">Esc&nbsp; normal</button><button type="button" data-command=":w">:w&nbsp; save</button><button type="button" data-command=":q">:q&nbsp; quit</button><button type="button" data-command=":wq">:wq&nbsp; save & quit</button></div>
    <div class="vim-command" hidden><span>:</span><input aria-label="Vim command" placeholder="w, q, or wq; press Enter"></div>`;
  output.append(wrapper);
  const textarea = wrapper.querySelector("textarea");
  const status = wrapper.querySelector(".vim-status");
  const commandRow = wrapper.querySelector(".vim-command");
  const commandInput = commandRow.querySelector("input");
  textarea.value = files.get(path);
  textarea.readOnly = true;
  function setMode(mode) {
    editor.mode = mode;
    status.textContent = mode;
    textarea.readOnly = mode !== "INSERT";
    wrapper.querySelectorAll("[data-mode]").forEach(button => button.classList.toggle("selected", button.dataset.mode === mode));
    if (mode === "INSERT") textarea.focus();
  }
  function applyVimCommand(command) {
    if (command === "w" || command === "wq") {
      files.set(path, textarea.value);
      status.textContent = "SAVED";
      if (
        basename(path) === "editme" &&
        textarea.value.split(/\r?\n/).some(line => line.trim() === "#hello")
      ) {
        taskProgress["edit-file"] = true;
        checkTaskProgress();
      }
    }
    if (command === "q" || command === "wq") {
      if (command === "q" && textarea.value !== files.get(path)) {
        status.textContent = "UNSAVED CHANGES — use :wq to save & quit";
        return;
      }
      wrapper.remove();
      editor = null;
      input.focus();
    }
  }
  wrapper.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  wrapper.querySelectorAll("[data-command]").forEach(button => button.addEventListener("click", () => applyVimCommand(button.dataset.command.slice(1))));
  textarea.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); setMode("NORMAL"); }
    else if (event.key === ":" && editor.mode === "NORMAL") {
      event.preventDefault();
      commandRow.hidden = false;
      commandInput.value = "";
      commandInput.focus();
    } else if (editor.mode === "NORMAL" && ["i", "a"].includes(event.key)) {
      event.preventDefault();
      setMode("INSERT");
    }
  });
  commandInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      const command = commandInput.value.trim();
      commandRow.hidden = true;
      applyVimCommand(command);
      if (editor) textarea.focus();
    } else if (event.key === "Escape") {
      commandRow.hidden = true;
      textarea.focus();
    }
  });
  output.scrollTop = output.scrollHeight;
  textarea.focus();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const command = input.value;
  if (command.trim()) {
    history.push(command);
    historyIndex = history.length;
    runCommand(command);
  }
  input.value = "";
});

input.addEventListener("keydown", event => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] ?? "";
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? "";
  } else if (event.key === "Tab") {
    event.preventDefault();
    const known = ["login", "pwd", "cd", "mkdir", "touch", "cat", "cp", "mv", "grep", "vim", "ls", "clear", "help"];
    const match = known.find(command => command.startsWith(input.value));
    if (match) input.value = match;
  }
});

document.querySelector("#reset-terminal").addEventListener("click", () => {
  resetTerminal();
});

function resetTerminal() {
  resetFilesystem();
  output.innerHTML = "";
  history = [];
  historyIndex = 0;
  editor = null;
  printLine("Practice workspace reset. You’re back in /home/student.");
  promptPath.textContent = "~";
  renderScoreboard();
  input.focus();
}

document.querySelector("#reset-terminal-fullscreen").addEventListener("click", resetTerminal);

const terminalShell = document.querySelector(".terminal-shell");
const fullscreenButton = document.querySelector("#fullscreen-terminal");

function setTerminalFullscreen(isFullscreen) {
  terminalShell.classList.toggle("is-fullscreen", isFullscreen);
  document.body.classList.toggle("terminal-fullscreen-open", isFullscreen);
  fullscreenButton.innerHTML = isFullscreen ? "⛶ <span>Exit full screen</span>" : "⛶ <span>Full screen</span>";
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit terminal full screen" : "Open terminal full screen");
  fullscreenButton.title = isFullscreen ? "Exit terminal full screen (Esc)" : "Open terminal full screen";
  if (isFullscreen) input.focus();
}

fullscreenButton.addEventListener("click", () => {
  setTerminalFullscreen(!terminalShell.classList.contains("is-fullscreen"));
});

function openTerminalFromHash() {
  if (window.location.hash === "#terminal") setTerminalFullscreen(true);
}

window.addEventListener("hashchange", openTerminalFromHash);
openTerminalFromHash();

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && editor === null && terminalShell.classList.contains("is-fullscreen")) {
    setTerminalFullscreen(false);
  }
});

input.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    output.innerHTML = "";
  } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    printPrompt(`${input.value}^C`);
    input.value = "";
  }
});

resetFilesystem();
renderScoreboard();
printLine("Welcome! This is a safe, simulated Linux terminal.");
printLine("Try pwd, ls, cat welcome.txt, or type help to get started.");
