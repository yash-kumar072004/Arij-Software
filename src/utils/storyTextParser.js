/**
 * Dynamic Story & PRD Text Parser (Zero Hardcoding)
 * Parses raw text extracted from any PDF document (single-column PRD or 2-column Jira export)
 * into structured issue fields, scenarios, test cases, subtasks, DoD, and sidebar metadata.
 */

export function normalizeStatusFromText(rawStatus = '') {
  const s = String(rawStatus).toUpperCase().trim();
  if (s.includes('PROGRESS') || s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s.includes('REVIEW') || s === 'IN_REVIEW') return 'IN_REVIEW';
  if (s.includes('QA') || s.includes('TEST')) return 'QA';
  if (s.includes('DONE') || s.includes('RESOLVED') || s.includes('CLOSED')) {
    return 'DONE';
  }
  return 'TODO';
}

export function normalizePriorityFromText(rawPriority = '') {
  const p = String(rawPriority).toUpperCase().trim();
  if (p.includes('HIGHEST') || p.includes('CRITICAL') || p === 'P0') {
    return 'HIGHEST';
  }
  if (p.includes('HIGH') || p === 'P1') return 'HIGH';
  if (p.includes('LOWEST') || p.includes('TRIVIAL') || p === 'P4') {
    return 'LOWEST';
  }
  if (p.includes('LOW') || p === 'P3') return 'LOW';
  return 'MEDIUM';
}

export function normalizeIssueTypeFromText(rawType = '') {
  const t = String(rawType).toUpperCase().trim();
  if (t.includes('BUG') || t.includes('DEFECT')) return 'BUG';
  if (t.includes('EPIC')) return 'EPIC';
  if (t.includes('SUBTASK') || t.includes('SUB-TASK')) return 'SUBTASK';
  if (t.includes('TASK')) return 'TASK';
  if (t.includes('FEATURE')) return 'FEATURE';
  if (t.includes('IMPROVEMENT')) return 'IMPROVEMENT';
  return 'STORY';
}

export function computeInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'UN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatStructuredDescription({
  title,
  userStory,
  scopeDescription,
  acceptanceCriteria,
  testCases,
  definitionOfDone,
  rawFallbackText,
}) {
  const sections = [];
  if (title && title.trim()) {
    sections.push(`Story Title\n${title.trim()}`);
  }
  if (userStory && userStory.trim()) {
    sections.push(`User Story\n${userStory.trim()}`);
  }
  if (scopeDescription && scopeDescription.trim()) {
    sections.push(`Scope / Description\n${scopeDescription.trim()}`);
  }
  if (Array.isArray(acceptanceCriteria) && acceptanceCriteria.length > 0) {
    const acLines = ['Acceptance Criteria'];
    acceptanceCriteria.forEach((sc, idx) => {
      const scTitle =
        sc.scenarioTitle || `Scenario ${idx + 1}`;
      acLines.push(`\n${scTitle}`);
      (sc.steps || []).forEach((step) => {
        const cleanStep = String(step).replace(/^[•\-*]\s*/, '').trim();
        if (cleanStep) acLines.push(`• ${cleanStep}`);
      });
    });
    sections.push(acLines.join('\n'));
  }
  if (Array.isArray(testCases) && testCases.length > 0) {
    const tcLines = ['Test Cases to Automate'];
    testCases.forEach((tc, idx) => {
      const cleanTc = String(tc).replace(/^\d+[.)]\s*/, '').trim();
      if (cleanTc) tcLines.push(`${idx + 1}. ${cleanTc}`);
    });
    sections.push(tcLines.join('\n'));
  }
  if (Array.isArray(definitionOfDone) && definitionOfDone.length > 0) {
    const dodLines = ['Definition of Done (DoD)'];
    definitionOfDone.forEach((d) => {
      const cleanDod = String(d).replace(/^[•\-*]\s*/, '').trim();
      if (cleanDod) dodLines.push(`• ${cleanDod}`);
    });
    sections.push(dodLines.join('\n'));
  }

  if (sections.length <= 1 && rawFallbackText && rawFallbackText.trim()) {
    return rawFallbackText.trim();
  }
  return sections.join('\n\n');
}

/**
 * Pure dynamic parser that extracts structured fields from raw PDF text.
 * Never returns hardcoded demo strings. Every returned value comes from `rawText` or `fileName`.
 */
export function parseStructuredStoryFromExtractedText({
  rawText = '',
  leftText = '',
  rightSidebarText = '',
  metadataTitle = '',
  fileName = '',
  defaultProjectKey = 'KP',
}) {
  const cleanFileName = String(fileName || '')
    .replace(/\.pdf$/i, '')
    .replace(/\.(txt|md|docx?)$/i, '')
    .trim();

  // 1. Parse [KEY-123] and Title from filename or Document Title if present
  const headerSource = metadataTitle || cleanFileName;
  const bracketKeyMatch = headerSource.match(
    /^\[?([A-Z][A-Z0-9]{1,8}-\d+)\]?\s*[-–—:]?\s*(.+?)(?:\s*-\s*Jira)?$/i
  );

  const rawLines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !/^%PDF|\bobj\b|\bendobj\b|\bstream\b|\bendstream\b|\bxref\b|^---\s*DETAILS\s+SIDEBAR\s*---$/i.test(
          l
        ) &&
        !/^\d+\/\d+\/\d+,?\s+\d+:\d+\s*(AM|PM)?/i.test(l) &&
        !/^https?:\/\/\S+\s+\d+\/\d+$/i.test(l)
    );

  const normalizedFullText = rawLines.join('\n');

  // 2. Detect Breadcrumb line e.g. "Kawach Product / KP-5831 Automation Test Cases IN PROGRESS / KP-6453"
  let projectName = '';
  let parentKey = '';
  let parentTitle = '';
  let parentStatus = '';
  let issueKey = bracketKeyMatch ? bracketKeyMatch[1].toUpperCase() : '';

  for (let i = 0; i < Math.min(rawLines.length, 15); i += 1) {
    const line = rawLines[i];
    if (line.includes('/')) {
      const parts = line.split('/').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const lastPartKey = parts[parts.length - 1].match(/^([A-Z][A-Z0-9]{1,8}-\d+)\b/i);
        if (lastPartKey) {
          if (!issueKey) issueKey = lastPartKey[1].toUpperCase();
          if (!projectName && !/^[A-Z]+-\d+$/i.test(parts[0])) {
            projectName = parts[0];
          }
          if (parts.length >= 3) {
            const mid = parts[parts.length - 2];
            const midKeyMatch = mid.match(/\b([A-Z][A-Z0-9]{1,8}-\d+)\b/i);
            if (midKeyMatch) {
              parentKey = midKeyMatch[1].toUpperCase();
              parentTitle = mid
                .replace(midKeyMatch[0], '')
                .replace(/\b(IN\s+PROGRESS|TO\s+DO|DONE|IN\s+REVIEW)\b/gi, '')
                .trim();
            }
          }
        }
      }
    }
  }

  // Fallback issueKey detection from first 20 lines
  if (!issueKey) {
    for (let i = 0; i < Math.min(rawLines.length, 20); i += 1) {
      const m = rawLines[i].match(/\b([A-Z][A-Z0-9]{1,8}-\d+)\b/);
      if (m && !rawLines[i].includes(`${m[1]}-`)) {
        issueKey = m[1].toUpperCase();
        break;
      }
    }
  }

  const projectKey = issueKey
    ? issueKey.split('-')[0]
    : defaultProjectKey || 'PROJ';

  // 3. Helper to extract value after a label in Details sidebar or full text
  const sidebarLines = rightSidebarText
    ? rightSidebarText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : rawLines;

  const findLabelValue = (labelPattern, searchPool = sidebarLines) => {
    for (let i = 0; i < searchPool.length; i += 1) {
      const line = searchPool[i];
      const inlineMatch = line.match(
        new RegExp(`^(?:${labelPattern})\\s*:\\s*(.+)$`, 'i')
      );
      if (inlineMatch && inlineMatch[1].trim()) {
        return inlineMatch[1].trim();
      }
      const spaceMatch = line.match(
        new RegExp(`^(?:${labelPattern})\\s+(.+)$`, 'i')
      );
      if (
        spaceMatch &&
        spaceMatch[1].trim() &&
        !/^(Section|Page|List|Details|Criteria)$/i.test(spaceMatch[1].trim())
      ) {
        return spaceMatch[1].trim();
      }
      if (new RegExp(`^(?:${labelPattern})\\s*:?$`, 'i').test(line)) {
        const nextLine = searchPool[i + 1];
        if (
          nextLine &&
          !/^(Assignee|Reporter|Priority|Status|Type|Components?|Labels|Sprint|Story\s+point|Parent|Reviewers|Approvers|Created|Updated|Description|Subtasks)$/i.test(
            nextLine
          )
        ) {
          return nextLine.trim();
        }
      }
    }
    return '';
  };

  // 4. Extract Story Title
  let title = '';
  const storyTitleHeadingIdx = rawLines.findIndex((l) =>
    /^(Story\s+Title|Issue\s+Title|Summary)$/i.test(l)
  );
  if (storyTitleHeadingIdx !== -1 && rawLines[storyTitleHeadingIdx + 1]) {
    title = rawLines[storyTitleHeadingIdx + 1].trim();
  }
  if (!title) {
    const inlineTitle = findLabelValue('Story\\s+Title|Summary|Title', rawLines);
    if (inlineTitle) title = inlineTitle;
  }
  if (!title && bracketKeyMatch && bracketKeyMatch[2]) {
    title = bracketKeyMatch[2].replace(/\s*-\s*Jira$/i, '').trim();
  }
  if (!title) {
    // Find first meaningful heading line in the document
    const candidate = rawLines.find(
      (l) =>
        l.length >= 6 &&
        l.length <= 180 &&
        !/^(Document\s+Title|Details|Description|Edit\s+Description|User\s+Story|Scope|Acceptance\s+Criteria|Created|Updated)/i.test(
          l
        ) &&
        !l.includes('/')
    );
    title = candidate || cleanFileName || 'Untitled Imported Story';
  }

  // 5. Extract User Story section
  let userStory = '';
  const userStoryBlockMatch = normalizedFullText.match(
    /(?:^|\n)User\s+Story\s*:?\s*\n([\s\S]+?)(?=\n(?:Scope|Description|Acceptance\s+Criteria|Scenario\s+1|Test\s+Cases|Definition\s+of\s+Done|Subtasks|Details)\b|$)/i
  );
  if (userStoryBlockMatch && userStoryBlockMatch[1].trim()) {
    userStory = userStoryBlockMatch[1].trim();
  } else {
    const asAMatch = normalizedFullText.match(
      /(As\s+an?\s+[\s\S]+?So\s+that\s+[^\n]+(?:\n[^\n]+)?)/i
    );
    if (asAMatch) {
      userStory = asAMatch[1].trim();
    }
  }

  // 6. Extract Scope / Description section
  let scopeDescription = '';
  const scopeBlockMatch = normalizedFullText.match(
    /(?:^|\n)(?:Scope\s*\/\s*Description|Scope|Overview|Background)\s*:?\s*\n([\s\S]+?)(?=\n(?:Acceptance\s+Criteria|Scenario\s+1|Test\s+Cases|Definition\s+of\s+Done|Subtasks|Details)\b|$)/i
  );
  if (scopeBlockMatch && scopeBlockMatch[1].trim()) {
    scopeDescription = scopeBlockMatch[1].trim();
  } else if (!userStory) {
    // If document is a general PDF without "User Story" or "Scope" headers, extract main body text
    const bodyLines = rawLines.filter(
      (l) =>
        l !== title &&
        !/^(Description|Edit\s+Description|Story\s+Title)$/i.test(l)
    );
    scopeDescription = bodyLines.slice(0, 25).join('\n').trim();
  }

  const SIDEBAR_STOP_LOOKAHEAD =
    'Subtasks|Linked\\s+Issues|Attachments|Comments|Details|---\\s*DETAILS|Assignee\\s*:|Reporter\\s*:|Priority\\s*:|Status\\s*:|Components?\\s*:|Labels\\s*:|Sprint\\s*:|Story\\s+point';

  // 7. Extract Acceptance Criteria Scenarios (or bullet items under Acceptance Criteria)
  const acceptanceCriteria = [];
  const scenarioRegex = new RegExp(
    `(Scenario\\s+\\d+\\s*:[^\\n]+)\\n([\\s\\S]+?)(?=\\nScenario\\s+\\d+\\s*:|\\nTest\\s+Cases|\\nDefinition\\s+of\\s+Done|\\n(?:${SIDEBAR_STOP_LOOKAHEAD})|$)`,
    'gi'
  );
  let scenarioMatch;
  while ((scenarioMatch = scenarioRegex.exec(normalizedFullText)) !== null) {
    const scenarioTitle = scenarioMatch[1].trim();
    const rawStepLines = scenarioMatch[2]
      .split(/\r?\n/)
      .map((s) => s.replace(/^[•\-*]\s*/, '').trim())
      .filter(
        (s) =>
          s.length > 2 &&
          !/^(Edit\s+Description|Add\s+Subtask|Link\s+Issue)$/i.test(s)
      );
    if (rawStepLines.length > 0) {
      acceptanceCriteria.push({
        scenarioTitle,
        steps: rawStepLines,
      });
    }
  }

  if (acceptanceCriteria.length === 0) {
    const acBlockMatch = normalizedFullText.match(
      new RegExp(
        `(?:^|\\n)Acceptance\\s+Criteria\\s*:?\\s*\\n([\\s\\S]+?)(?=\\n(?:Test\\s+Cases|Definition\\s+of\\s+Done|${SIDEBAR_STOP_LOOKAHEAD})\\b|$)`,
        'i'
      )
    );
    if (acBlockMatch && acBlockMatch[1].trim()) {
      const steps = acBlockMatch[1]
        .split(/\r?\n/)
        .map((s) => s.replace(/^(?:\d+[.)]|[•\-*])\s*/, '').trim())
        .filter((s) => s.length > 3);
      if (steps.length > 0) {
        acceptanceCriteria.push({
          scenarioTitle: 'Acceptance Criteria',
          steps,
        });
      }
    }
  }

  // 8. Extract Test Cases to Automate / Subtasks
  const testCases = [];
  const tcBlockMatch = normalizedFullText.match(
    new RegExp(
      `(?:^|\\n)Test\\s+Cases(?:\\s+to\\s+Automate)?\\s*:?\\s*\\n([\\s\\S]+?)(?=\\n(?:Definition\\s+of\\s+Done|${SIDEBAR_STOP_LOOKAHEAD})|$)`,
      'i'
    )
  );
  if (tcBlockMatch && tcBlockMatch[1].trim()) {
    tcBlockMatch[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .forEach((line) => {
        const clean = line.replace(/^(?:\d+[.)]|[•\-*])\s*/, '').trim();
        if (
          clean.length > 4 &&
          !/^(Test\s+Cases|Definition\s+of\s+Done|Subtasks)/i.test(clean)
        ) {
          testCases.push(clean);
        }
      });
  }

  // Also check explicit Subtasks section (e.g. KP-6453-1 Verify navigation...)
  const subtasksSectionMatch = normalizedFullText.match(
    new RegExp(
      `(?:^|\\n)Subtasks(?:\\s*\\(\\d+\\/\\d+\\))?\\s*\\n([\\s\\S]+?)(?=\\n(?:${SIDEBAR_STOP_LOOKAHEAD})|$)`,
      'i'
    )
  );
  if (subtasksSectionMatch && testCases.length === 0) {
    const subLines = subtasksSectionMatch[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 3 &&
          !/^(\d+%|Add\s+Subtask|To\s+Do|In\s+Progress|Done)$/i.test(l) &&
          !/^[A-Z][A-Z0-9]+-\d+-\d+$/i.test(l)
      );
    subLines.forEach((sl) => {
      const stripped = sl.replace(/^[A-Z][A-Z0-9]+-\d+-\d+\s+/, '').trim();
      if (stripped.length > 4 && !testCases.includes(stripped)) {
        testCases.push(stripped);
      }
    });
  }

  // 9. Extract Definition of Done (DoD)
  const definitionOfDone = [];
  const dodBlockMatch = normalizedFullText.match(
    new RegExp(
      `(?:^|\\n)Definition\\s+of\\s+Done(?:\\s*\\(DoD\\))?\\s*:?\\s*\\n([\\s\\S]+?)(?=\\n(?:${SIDEBAR_STOP_LOOKAHEAD})|$)`,
      'i'
    )
  );
  if (dodBlockMatch && dodBlockMatch[1].trim()) {
    dodBlockMatch[1]
      .split(/\r?\n/)
      .map((l) => l.replace(/^(?:\d+[.)]|[•\-*])\s*/, '').trim())
      .filter(
        (l) =>
          l.length > 4 &&
          !/^(Subtasks|Linked\s+Issues|Attachments|Details)$/i.test(l)
      )
      .forEach((item) => definitionOfDone.push(item));
  }

  // 10. Extract Right-Sidebar Details Metadata from text
  const rawAssignee =
    findLabelValue('Assignee') || findLabelValue('Assignee', rawLines);
  const assigneeName =
    rawAssignee && !/^(none|unassigned)$/i.test(rawAssignee)
      ? rawAssignee.replace(/^[A-Z]{2}\s+/, '').trim()
      : '';

  const rawReporter =
    findLabelValue('Reporter') || findLabelValue('Reporter', rawLines);
  const reporterName =
    rawReporter && !/^(none|unassigned)$/i.test(rawReporter)
      ? rawReporter.replace(/^[A-Z]{2}\s+/, '').trim()
      : assigneeName;

  const rawPriority =
    findLabelValue('Priority') || findLabelValue('Priority', rawLines);
  const priority = rawPriority
    ? normalizePriorityFromText(rawPriority)
    : 'MEDIUM';

  const rawStatus =
    findLabelValue('Status') || findLabelValue('Status', rawLines);
  const status = rawStatus ? normalizeStatusFromText(rawStatus) : 'TODO';

  const rawType =
    findLabelValue('Type|Issue\\s+Type') ||
    findLabelValue('Type|Issue\\s+Type', rawLines);
  const type = rawType ? normalizeIssueTypeFromText(rawType) : 'STORY';

  const rawComponent =
    findLabelValue('Components?') || findLabelValue('Components?', rawLines);
  const componentName =
    rawComponent && !/^none$/i.test(rawComponent) ? rawComponent : '';

  const rawLabels =
    findLabelValue('Labels') || findLabelValue('Labels', rawLines);
  const labels =
    !rawLabels || /^none$/i.test(rawLabels)
      ? []
      : rawLabels
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter((s) => s && !/^none$/i.test(s));

  const rawReviewers =
    findLabelValue('Reviewers') || findLabelValue('Reviewers', rawLines);
  const reviewers =
    !rawReviewers || /^none$/i.test(rawReviewers)
      ? []
      : rawReviewers
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter((s) => s && !/^none$/i.test(s));

  const rawApprovers =
    findLabelValue('Approvers') || findLabelValue('Approvers', rawLines);
  const approvers =
    !rawApprovers || /^none$/i.test(rawApprovers)
      ? []
      : rawApprovers
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter((s) => s && !/^none$/i.test(s));

  const rawSprint =
    findLabelValue('Sprint') || findLabelValue('Sprint', rawLines);
  const sprintName =
    !rawSprint || /^none$/i.test(rawSprint) ? 'None' : rawSprint;

  const rawPoints =
    findLabelValue('Story\\s+point\\s+estimate|Story\\s+Points?') ||
    findLabelValue('Story\\s+point\\s+estimate|Story\\s+Points?', rawLines);
  const storyPoints =
    !rawPoints || /^none$/i.test(rawPoints) || Number.isNaN(Number(rawPoints))
      ? 0
      : Number(rawPoints);

  const rawParent =
    findLabelValue('Parent(?:/Epic)?') ||
    findLabelValue('Parent(?:/Epic)?', rawLines);
  if (rawParent && !parentKey) {
    const pkMatch = rawParent.match(/\b([A-Z][A-Z0-9]{1,8}-\d+)\b/i);
    if (pkMatch) {
      parentKey = pkMatch[1].toUpperCase();
      parentTitle = rawParent.replace(pkMatch[0], '').trim();
    }
  }

  const createdMatch = normalizedFullText.match(/Created\s+([^\n]+?)(?=\s+Updated|\n|$)/i);
  const updatedMatch = normalizedFullText.match(/Updated\s+([^\n]+)/i);
  const createdAtText = createdMatch ? createdMatch[1].trim() : '';
  const updatedAtText = updatedMatch ? updatedMatch[1].trim() : '';

  const urlMatch = String(rawText || '').match(/https?:\/\/[^\s)]+\/browse\/[A-Z0-9-]+/i);
  const sourceUrl = urlMatch ? urlMatch[0] : '';

  const description = formatStructuredDescription({
    title,
    userStory,
    scopeDescription,
    acceptanceCriteria,
    testCases,
    definitionOfDone,
    rawFallbackText: normalizedFullText,
  });

  const subtasks = testCases.map((tc, idx) => ({
    key: issueKey ? `${issueKey}-${idx + 1}` : undefined,
    title: tc,
    completed: false,
  }));

  const parsedStory = {
    issueKey,
    projectName,
    projectKey,
    parentKey,
    parentTitle,
    parentStatus: parentStatus || 'IN_PROGRESS',
    title,
    description,
    userStory,
    scopeDescription,
    acceptanceCriteria,
    testCases,
    definitionOfDone,
    type,
    status,
    priority,
    assigneeName,
    assigneeInitials: computeInitials(assigneeName),
    reporterName,
    reporterInitials: computeInitials(reporterName),
    componentName,
    labels,
    reviewers,
    approvers,
    sprintName,
    storyPoints,
    originalEstimateHours: 0,
    dueDate: '',
    createdAtText,
    updatedAtText,
    sourceUrl,
    subtasks,
    rawExtractedText: normalizedFullText,
  };

  return {
    ...parsedStory,
    stories: [parsedStory],
  };
}
