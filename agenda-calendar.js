import {patientDisplayName,patientMatches} from './clinic-search.js';

const palette = {
  scheduled: { backgroundColor: '#2782b6', borderColor: '#1c6d9b' },
  confirmed: { backgroundColor: '#2f8b65', borderColor: '#24714f' },
  checked_in: { backgroundColor: '#2f8b65', borderColor: '#24714f' },
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
    person?.social_name,
    person?.phone,
    appointment.procedure_name,
  ].filter(Boolean).join(' ')).includes(query);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function eventFor(appointment, patients, query, patientId = '') {
  const person = patients.find((item) => item.id === appointment.patient_id);
  const pending=appointment.approval_status==='pending'&&appointment.status!=='cancelled';
  const colors = pending?{backgroundColor:'#b27a20',borderColor:'#966418'}:palette[appointment.status] || palette.scheduled;
  const canMove = !['cancelled', 'completed', 'no_show'].includes(appointment.status);
  return {
    id: appointment.id,
    title: `${pending?'A confirmar · ':''}${patientDisplayName(person)} · ${appointment.procedure_name || 'Consulta'}`,
    start: appointment.starts_at,
    end: appointment.ends_at,
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    textColor: '#ffffff',
    editable: canMove,
    extendedProps: { appointment },
    display: (!patientId || appointment.patient_id === patientId) && matches(appointment, patients, query) ? 'auto' : 'none',
  };
}

export function mountAgendaCalendar(options) {
  const {
    element,
    clinicId,
    patients = [],
    loadAppointments,
    availability,
    onCreate,
    onManage,
    onReschedule,
    onError,
    onSearchChange,
    onExpandChange,
    searchInput,
    patientResults,
    searchStatus,
    expandButton,
    expanded = false,
    initialSearch = '',
    initialPatientId = '',
  } = options;

  if (!element || !window.FullCalendar?.Calendar) {
    onError?.(new Error('O calendário não carregou. Atualize a página e tente novamente.'));
    return { destroy() {} };
  }

  let searchValue = initialSearch;
  let selectedPatientId = initialPatientId;
  let lastRecords = [];
  let disposed = false;
  let expandedNow = expanded;
  const card = element.closest('.calendar-card');
  const pendingMoves = new Set();
  const query = () => normalize(searchValue);

  function updateSearchStatus(records) {
    if (!searchStatus) return;
    const filterText = selectedPatientId ? '' : query();
    const visible = records.filter((record) => {
      return (!selectedPatientId || record.patient_id === selectedPatientId)
        && matches(record, patients, filterText);
    }).length;
    const selectedPatient = patients.find((item) => item.id === selectedPatientId);
    searchStatus.textContent = selectedPatient
      ? `${patientDisplayName(selectedPatient)}: ${visible} compromisso${visible === 1 ? '' : 's'} neste período.`
      : searchValue.trim()
      ? `${visible} compromisso${visible === 1 ? '' : 's'} encontrado${visible === 1 ? '' : 's'} neste período.`
      : `${records.length} compromisso${records.length === 1 ? '' : 's'} neste período.`;
  }

  function applySearch() {
    const activeQuery = selectedPatientId ? '' : query();
    let visible = 0;
    calendar.getEvents().forEach((event) => {
      const appointment = event.extendedProps.appointment;
      if(!appointment)return;
      const show = (!selectedPatientId || appointment.patient_id === selectedPatientId)
        && matches(appointment, patients, activeQuery);
      event.setProp('display', show ? 'auto' : 'none');
      if (show) visible += 1;
    });
    if (searchStatus) {
      const selectedPatient = patients.find((item) => item.id === selectedPatientId);
      searchStatus.textContent = selectedPatient
        ? `${patientDisplayName(selectedPatient)}: ${visible} compromisso${visible === 1 ? '' : 's'} neste período.`
        : searchValue.trim()
        ? `${visible} compromisso${visible === 1 ? '' : 's'} encontrado${visible === 1 ? '' : 's'} neste período.`
        : `${lastRecords.length} compromisso${lastRecords.length === 1 ? '' : 's'} neste período.`;
    }
  }

  function renderPatientResults() {
    if (!patientResults) return;
    const activeQuery = query();
    if (!activeQuery) {
      patientResults.innerHTML = '';
      patientResults.classList.remove('open');
      return;
    }
    const found = patients.filter((person) => patientMatches(activeQuery,person)).slice(0, 8);
    patientResults.innerHTML = found.length
      ? found.map((person) => `<button type="button" role="option" data-agenda-patient="${escapeHtml(person.id)}"><b>${escapeHtml(patientDisplayName(person))}</b><small>${person.social_name&&person.social_name!==person.full_name?`Cadastro: ${escapeHtml(person.full_name)} · `:''}${escapeHtml(person.phone || 'Telefone não informado')}</small></button>`).join('')
      : `<div class="patient-search-empty">Nenhum paciente cadastrado corresponde a esta busca.</div>`;
    patientResults.classList.add('open');
  }

  function selectPatient(patientId) {
    const selected = patients.find((person) => person.id === patientId);
    if (!selected) return;
    selectedPatientId = selected.id;
    searchValue = patientDisplayName(selected);
    if (searchInput) searchInput.value = searchValue;
    patientResults?.classList.remove('open');
    if (patientResults) patientResults.innerHTML = '';
    onSearchChange?.(searchValue, selectedPatientId);
    applySearch();
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
    initialView: window.matchMedia('(max-width: 700px)').matches ? 'timeGridDay' : 'timeGridWeek',
    height: 'auto',
    expandRows: true,
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    unselectAuto: true,
    editable: true,
    eventDurationEditable: true,
    eventStartEditable: true,
    slotDuration: '00:30:00',
    snapDuration: '00:15:00',
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    scrollTime: '08:00:00',
    allDaySlot: true,
    dayMaxEvents: true,
    headerToolbar: {
      start: 'prev,next today',
      center: 'title',
      end: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek',
    },
    headerToolbarClass: 'agenda-toolbar',
    toolbarTitleClass: 'agenda-toolbar-title',
    toolbarSectionClass: 'agenda-toolbar-section',
    buttonClass: (data) => `agenda-button${data.isSelected ? ' is-active' : ''}`,
    buttons: {
      today: { text: 'Hoje' },
      timeGridDay: { text: 'Dia' },
      timeGridWeek: { text: 'Semana' },
      dayGridMonth: { text: 'Mês' },
      listWeek: { text: 'Lista' },
    },
    noEventsContent: 'Nenhum compromisso neste período.',
    events(fetchInfo, success, failure) {
      Promise.resolve(loadAppointments(fetchInfo.start, fetchInfo.end))
        .then((records) => {
          if (disposed) return;
          lastRecords = records || [];
          updateSearchStatus(lastRecords);
          success([...lastRecords.map((record) => eventFor(record, patients, selectedPatientId ? '' : query(), selectedPatientId)),...(availability?.events(fetchInfo.start,fetchInfo.end)||[])]);
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
      const marking=(document.querySelector('#agenda-mode')?.value||'appointment')!=='appointment';
      if (info.allDay || info.view.type === 'dayGridMonth') start.setHours(marking?0:9, 0, 0, 0);
      onCreate?.(start,new Date(start.getTime()+(marking&&info.allDay?24:1)*60*60*1000),selectedPatientId,{allDay:marking&&info.allDay});
    },
    select(info) {
      let start = new Date(info.start);
      let end = new Date(info.end);
      const marking=(document.querySelector('#agenda-mode')?.value||'appointment')!=='appointment';
      if (info.allDay && !marking) {
        start.setHours(9, 0, 0, 0);
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      calendar.unselect();
      onCreate?.(start,end,selectedPatientId,{allDay:marking&&info.allDay});
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
    selectedPatientId = '';
    onSearchChange?.(searchValue, selectedPatientId);
    renderPatientResults();
    applySearch();
  }

  function handleSearchKeyDown(event) {
    const options = Array.from(patientResults?.querySelectorAll('[data-agenda-patient]') || []);
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === 'Enter' && options.length && patientResults?.classList.contains('open')) {
      event.preventDefault();
      options[0].click();
    } else if (event.key === 'Escape') {
      patientResults?.classList.remove('open');
    }
  }

  function handlePatientResultKeyDown(event) {
    const options = Array.from(patientResults.querySelectorAll('[data-agenda-patient]'));
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)].focus();
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      if (index <= 0) searchInput?.focus();
      else options[index - 1].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      patientResults.classList.remove('open');
      searchInput?.focus();
    }
  }

  function handlePatientResultClick(event) {
    const option = event.target.closest('[data-agenda-patient]');
    if (option) selectPatient(option.dataset.agendaPatient);
  }

  function handlePatientResultMouseDown(event) {
    if (event.target.closest('[data-agenda-patient]')) event.preventDefault();
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
  searchInput?.addEventListener('keydown', handleSearchKeyDown);
  patientResults?.addEventListener('keydown', handlePatientResultKeyDown);
  patientResults?.addEventListener('click', handlePatientResultClick);
  patientResults?.addEventListener('mousedown', handlePatientResultMouseDown);
  expandButton?.addEventListener('click', toggleExpanded);
  document.addEventListener('keydown', handleKeyDown);
  calendar.render();
  applyExpandedState();

  return {
    calendar,
    destroy() {
      disposed = true;
      searchInput?.removeEventListener('input', handleSearch);
      searchInput?.removeEventListener('keydown', handleSearchKeyDown);
      patientResults?.removeEventListener('keydown', handlePatientResultKeyDown);
      patientResults?.removeEventListener('click', handlePatientResultClick);
      patientResults?.removeEventListener('mousedown', handlePatientResultMouseDown);
      expandButton?.removeEventListener('click', toggleExpanded);
      document.removeEventListener('keydown', handleKeyDown);
      if (expandedNow) document.body.classList.remove('calendar-overlay-open');
      calendar.destroy();
    },
    refetch() { calendar.refetchEvents(); },
  };
}
