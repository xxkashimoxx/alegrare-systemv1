const palette = {
  scheduled: { backgroundColor: '#2782b6', borderColor: '#1c6d9b' },
  confirmed: { backgroundColor: '#2f8b65', borderColor: '#24714f' },
  completed: { backgroundColor: '#71818b', borderColor: '#5d6b74' },
  no_show: { backgroundColor: '#c27b32', borderColor: '#a96322' },
  cancelled: { backgroundColor: '#9aa4ab', borderColor: '#7d878e' },
};

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

function matches(appointment, patients, query) {
  if (!query) return true;
  const person = patients.find((item) => item.id === appointment.patient_id);
  return normalize([
    person?.full_name,
    person?.phone,
    appointment.procedure_name,
  ].filter(Boolean).join(' ')).includes(query);
}

function eventFor(appointment, patients, query) {
  const person = patients.find((item) => item.id === appointment.patient_id);
  const colors = palette[appointment.status] || palette.scheduled;
  const canMove = !['cancelled', 'completed', 'no_show'].includes(appointment.status);
  return {
    id: appointment.id,
    title: `${person?.full_name || 'Paciente'} · ${appointment.procedure_name || 'Consulta'}`,
    start: appointment.starts_at,
    end: appointment.ends_at,
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    textColor: '#ffffff',
    editable: canMove,
    extendedProps: { appointment },
    display: matches(appointment, patients, query) ? 'auto' : 'none',
  };
}

export function mountAgendaCalendar(options) {
  const {
    element,
    clinicId,
    patients = [],
    loadAppointments,
    onCreate,
    onManage,
    onReschedule,
    onError,
    onSearchChange,
    onExpandChange,
    searchInput,
    searchStatus,
    expandButton,
    expanded = false,
    initialSearch = '',
  } = options;

  if (!element || !window.FullCalendar?.Calendar) {
    onError?.(new Error('O calendário não carregou. Atualize a página e tente novamente.'));
    return { destroy() {} };
  }

  let searchValue = initialSearch;
  let lastRecords = [];
  let disposed = false;
  let expandedNow = expanded;
  const card = element.closest('.calendar-card');
  const pendingMoves = new Set();
  const query = () => normalize(searchValue);

  function updateSearchStatus(records) {
    if (!searchStatus) return;
    const visible = records.filter((record) => matches(record, patients, query())).length;
    searchStatus.textContent = searchValue.trim()
      ? `${visible} compromisso${visible === 1 ? '' : 's'} encontrado${visible === 1 ? '' : 's'} neste período.`
      : `${records.length} compromisso${records.length === 1 ? '' : 's'} neste período.`;
  }

  function applySearch() {
    const activeQuery = query();
    let visible = 0;
    calendar.getEvents().forEach((event) => {
      const appointment = event.extendedProps.appointment;
      const show = matches(appointment, patients, activeQuery);
      event.setProp('display', show ? 'auto' : 'none');
      if (show) visible += 1;
    });
    if (searchStatus) {
      searchStatus.textContent = searchValue.trim()
        ? `${visible} compromisso${visible === 1 ? '' : 's'} encontrado${visible === 1 ? '' : 's'} neste período.`
        : `${lastRecords.length} compromisso${lastRecords.length === 1 ? '' : 's'} neste período.`;
    }
  }

  async function saveMovedEvent(info) {
    const appointment = info.event.extendedProps.appointment;
    if (!appointment || pendingMoves.has(appointment.id)) {
      info.revert();
      return;
    }
    pendingMoves.add(appointment.id);
    try {
      const duration = new Date(appointment.ends_at) - new Date(appointment.starts_at);
      const start = new Date(info.event.start);
      if (info.event.allDay) {
        const previousStart = new Date(appointment.starts_at);
        start.setHours(previousStart.getHours(), previousStart.getMinutes(), previousStart.getSeconds(), previousStart.getMilliseconds());
      }
      const end = info.event.allDay || !info.event.end
        ? new Date(start.getTime() + duration)
        : new Date(info.event.end);
      const updated = await onReschedule(appointment, start, end);
      if (!updated) {
        info.revert();
        return;
      }
      lastRecords = lastRecords.map((record) => record.id === updated.id ? updated : record);
      calendar.refetchEvents();
    } catch (error) {
      info.revert();
      onError?.(error);
    } finally {
      pendingMoves.delete(appointment.id);
    }
  }

  const calendar = new window.FullCalendar.Calendar(element, {
    locale: 'pt-br',
    firstDay: 1,
    initialView: 'timeGridWeek',
    height: 'auto',
    expandRows: true,
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    unselectAuto: true,
    editable: true,
    eventDurationEditable: true,
    eventStartEditable: true,
    slotDuration: '00:15:00',
    snapDuration: '00:15:00',
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    scrollTime: '08:00:00',
    allDaySlot: true,
    dayMaxEvents: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridWeek,dayGridMonth,listWeek',
    },
    buttonText: { today: 'Hoje', timeGridWeek: 'Semana', dayGridMonth: 'Mês', listWeek: 'Lista' },
    noEventsContent: 'Nenhum compromisso neste período.',
    events(fetchInfo, success, failure) {
      Promise.resolve(loadAppointments(fetchInfo.start, fetchInfo.end))
        .then((records) => {
          if (disposed) return;
          lastRecords = records || [];
          updateSearchStatus(lastRecords);
          success(lastRecords.map((record) => eventFor(record, patients, query())));
        })
        .catch((error) => {
          if (disposed) return;
          onError?.(error);
          failure(error);
        });
    },
    loading(isLoading) {
      card?.classList.toggle('calendar-loading', isLoading);
    },
    dateClick(info) {
      const start = new Date(info.date);
      if (info.allDay || info.view.type === 'dayGridMonth') start.setHours(9, 0, 0, 0);
      onCreate?.(start, new Date(start.getTime() + 60 * 60 * 1000));
    },
    select(info) {
      let start = new Date(info.start);
      let end = new Date(info.end);
      if (info.allDay) {
        start.setHours(9, 0, 0, 0);
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      calendar.unselect();
      onCreate?.(start, end);
    },
    eventClick(info) {
      info.jsEvent.preventDefault();
      const appointment = info.event.extendedProps.appointment;
      if (appointment) onManage?.(appointment);
    },
    eventDrop: saveMovedEvent,
    eventResize: saveMovedEvent,
  });

  function handleSearch() {
    searchValue = searchInput.value;
    onSearchChange?.(searchValue);
    applySearch();
  }

  function applyExpandedState() {
    card?.classList.toggle('is-expanded', expandedNow);
    document.body.classList.toggle('calendar-overlay-open', expandedNow);
    if (expandButton) {
      expandButton.textContent = expandedNow ? 'Reduzir agenda' : 'Expandir agenda';
      expandButton.setAttribute('aria-pressed', String(expandedNow));
    }
  }

  function toggleExpanded() {
    expandedNow = !expandedNow;
    applyExpandedState();
    onExpandChange?.(expandedNow);
    requestAnimationFrame(() => calendar.updateSize());
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && expandedNow) toggleExpanded();
  }

  searchInput?.addEventListener('input', handleSearch);
  expandButton?.addEventListener('click', toggleExpanded);
  document.addEventListener('keydown', handleKeyDown);
  calendar.render();
  applyExpandedState();

  return {
    calendar,
    destroy() {
      disposed = true;
      searchInput?.removeEventListener('input', handleSearch);
      expandButton?.removeEventListener('click', toggleExpanded);
      document.removeEventListener('keydown', handleKeyDown);
      if (expandedNow) document.body.classList.remove('calendar-overlay-open');
      calendar.destroy();
    },
    refetch() { calendar.refetchEvents(); },
  };
}
