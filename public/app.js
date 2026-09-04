document.addEventListener('DOMContentLoaded', () => {
    let currentDate = new Date();
    
    const driverOptions = [
        { id: 'loic', label: 'Loïc', color: 'bg-blue-500' },
        { id: 'annelise', label: 'Anne-Lise', color: 'bg-violet-500' },
        { id: 'sandra', label: 'Sandra', color: 'bg-emerald-500' },
        { id: 'jeremy', label: 'Jérémy', color: 'bg-amber-500' },
        { id: 'train', label: 'Train 🚆', color: 'bg-orange-500' },
        { id: 'none', label: 'Aucun ❌', color: 'bg-gray-400' }
    ];

    const childrenList = [
        { id: 'chloe', name: 'Chloé' },
        { id: 'illona', name: 'Illona' }
    ];

    // Calendar settings
    const startHour = 7;
    const endHour = 19;
    const pxPerMinute = 1.5;
    const totalHeight = (endHour - startHour) * 60 * pxPerMinute;

    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password-input').value;
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (res.ok) showApp();
        else loginError.classList.remove('hidden');
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    });

    function showLogin() {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }

    function showApp() {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('flex');
        renderWeek();
    }

    function getMonday(d) {
        d = new Date(d);
        var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6: 1);
        return new Date(d.setDate(diff));
    }

    function formatDate(date) {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    }

    function getDisplayDate(date) {
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
    function getDayName(date) {
        return date.toLocaleDateString('fr-FR', { weekday: 'long' });
    }

    document.getElementById('prev-week').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 7);
        renderWeek();
    });

    document.getElementById('next-week').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 7);
        renderWeek();
    });

    async function fetchSchedule(startDate, endDate) {
        const res = await fetch(`/api/week?startDate=${startDate}&endDate=${endDate}`);
        if (res.status === 401) { showLogin(); return null; }
        return await res.json();
    }

    async function updateSchedule(dateStr, type, passengersObj, timeVal) {
        // Send driver as null since we don't use it anymore
        const res = await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, type, driver: null, passengers: passengersObj, time: timeVal })
        });
        if (res.status === 401) showLogin();
        else renderWeek();
    }

    function parseTime(timeStr) {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    // --- Modal Logic ---
    let currentEdit = null;
    const editModal = document.getElementById('edit-modal');
    
    function openModal(dateStr, type, dayData, sEvents = []) {
        const data = dayData[type];
        
        let defaultTime = type === 'morning' ? '07:30' : '17:00';
        if (sEvents.length > 0) {
            if (type === 'morning') {
                const startMin = parseTime(sEvents[0].start);
                if (startMin) {
                    const departure = startMin - 15;
                    const h = Math.floor(departure / 60).toString().padStart(2, '0');
                    const m = (departure % 60).toString().padStart(2, '0');
                    defaultTime = `${h}:${m}`;
                }
            } else {
                defaultTime = sEvents[sEvents.length-1].end;
            }
        }

        currentEdit = {
            dateStr,
            type,
            passengers: { ...data.passengers }, // e.g. { "chloe": "loic", "illona": "none" }
            time: data.time || defaultTime
        };

        const titlePrefix = type === 'morning' ? 'Aller' : 'Retour';
        document.getElementById('modal-title').textContent = `${titlePrefix} (${dateStr})`;

        const mPassengers = document.getElementById('modal-passengers');
        mPassengers.innerHTML = '';
        
        childrenList.forEach(child => {
            const row = document.createElement('div');
            row.className = 'flex flex-col gap-1 mb-2 bg-gray-50 p-2 rounded';
            
            const nameLabel = document.createElement('span');
            nameLabel.className = 'font-bold text-gray-800 text-sm';
            nameLabel.textContent = child.name;
            row.appendChild(nameLabel);
            
            const btnGroup = document.createElement('div');
            btnGroup.className = 'flex flex-wrap gap-1.5';
            
            driverOptions.forEach(opt => {
                const btn = document.createElement('button');
                btn.textContent = opt.label;
                
                const currentOpt = currentEdit.passengers[child.id] || 'none';
                const isSelected = currentOpt === opt.id;
                
                btn.className = `px-2 py-1 text-xs font-medium border border-gray-300 rounded-md transition-colors ${isSelected ? opt.color + ' text-white border-transparent' : 'bg-white text-gray-700 hover:bg-gray-100'}`;
                
                btn.onclick = () => {
                    currentEdit.passengers[child.id] = opt.id;
                    
                    Array.from(btnGroup.querySelectorAll('button')).forEach(b => {
                        b.className = 'px-2 py-1 text-xs font-medium border border-gray-300 rounded-md transition-colors bg-white text-gray-700 hover:bg-gray-100';
                    });
                    btn.className = `px-2 py-1 text-xs font-medium border border-transparent rounded-md transition-colors ${opt.color} text-white`;
                };
                
                btnGroup.appendChild(btn);
            });
            
            row.appendChild(btnGroup);
            mPassengers.appendChild(row);
        });

        document.getElementById('modal-time').value = currentEdit.time;
        editModal.classList.remove('hidden');
    }

    document.getElementById('modal-close').onclick = () => editModal.classList.add('hidden');
    document.getElementById('modal-save').onclick = () => {
        editModal.classList.add('hidden');
        const timeInput = document.getElementById('modal-time').value;
        updateSchedule(currentEdit.dateStr, currentEdit.type, currentEdit.passengers, timeInput);
    };

    // --- Render Grid ---
    async function renderWeek() {
        const monday = getMonday(currentDate);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const startDateStr = formatDate(monday);
        const endDateStr = formatDate(friday);

        document.getElementById('current-week-label').textContent = `${getDisplayDate(monday)} au ${getDisplayDate(friday)}`;

        const data = await fetchSchedule(startDateStr, endDateStr);
        if (!data) return;

        const { schedule, schoolEvents } = data;

        const timeAxis = document.getElementById('time-axis');
        timeAxis.innerHTML = '';
        timeAxis.style.height = `${totalHeight}px`;
        for (let h = startHour; h <= endHour; h++) {
            const label = document.createElement('div');
            label.className = 'absolute w-full transform -translate-y-1/2 text-gray-400 font-medium';
            label.style.top = `${(h - startHour) * 60 * pxPerMinute}px`;
            label.textContent = `${h.toString().padStart(2, '0')}:00`;
            timeAxis.appendChild(label);
        }

        const headers = document.getElementById('calendar-headers');
        headers.innerHTML = '';
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        for (let i = 0; i < 5; i++) {
            const currentDay = new Date(monday);
            currentDay.setDate(monday.getDate() + i);
            const dateStr = formatDate(currentDay);
            
            const dayData = schedule[dateStr] || { 
                morning: { passengers: {}, time: null }, 
                evening: { passengers: {}, time: null } 
            };
            const sEvents = schoolEvents[dateStr] || [];
            // Il est impératif de trier les cours par heure car le fichier ICS peut les envoyer dans le désordre !
            sEvents.sort((a, b) => parseTime(a.start) - parseTime(b.start));

            const header = document.createElement('div');
            header.className = 'bg-gray-100 text-center py-2 rounded-lg z-10 border border-gray-200 sticky top-0 h-10';
            header.innerHTML = `<h3 class="font-bold text-sm text-gray-800">${getDayName(currentDay).substring(0,3).toUpperCase()} ${getDisplayDate(currentDay)}</h3>`;
            headers.appendChild(header);

            const col = document.createElement('div');
            col.className = 'flex flex-col relative';

            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'relative flex-1 bg-white border-l border-r border-b border-gray-100 rounded-b-lg overflow-hidden';
            eventsContainer.style.height = `${totalHeight}px`;

            for (let h = startHour; h < endHour; h++) {
                const line = document.createElement('div');
                line.className = 'absolute w-full border-t border-gray-100';
                line.style.top = `${(h - startHour) * 60 * pxPerMinute}px`;
                eventsContainer.appendChild(line);
            }

            sEvents.forEach(ev => {
                const startMin = parseTime(ev.start);
                const endMin = parseTime(ev.end);
                if (startMin && endMin && startMin >= startHour*60 && startMin <= endHour*60) {
                    const block = document.createElement('div');
                    const top = (startMin - startHour*60) * pxPerMinute;
                    const height = (endMin - startMin) * pxPerMinute;
                    block.className = 'absolute w-full bg-indigo-50 border-l-4 border-indigo-300 p-1 text-[10px] text-indigo-700 overflow-hidden';
                    block.style.top = `${top}px`;
                    block.style.height = `${height}px`;
                    block.innerHTML = `<div class="font-semibold truncate">${ev.summary || 'Cours'}</div><div>${ev.start} - ${ev.end}</div>`;
                    eventsContainer.appendChild(block);
                }
            });

            const drawTrip = (type, dataObj) => {
                let time = dataObj.time;
                if (!time) {
                    if (sEvents.length > 0) {
                        if (type === 'morning') {
                            const startMin = parseTime(sEvents[0].start);
                            if (startMin) {
                                const departure = startMin - 15;
                                const h = Math.floor(departure / 60).toString().padStart(2, '0');
                                const m = (departure % 60).toString().padStart(2, '0');
                                time = `${h}:${m}`;
                            } else {
                                time = '07:45';
                            }
                        } else {
                            time = sEvents[sEvents.length-1].end;
                        }
                    } else {
                        time = type === 'morning' ? '07:45' : '17:00';
                    }
                }
                
                const startMin = parseTime(time);
                if (startMin) {
                    const block = document.createElement('div');
                    const top = (startMin - startHour*60) * pxPerMinute;
                    
                    // Determine dominant color or multi-color logic
                    // If multiple drivers, use a generic color (e.g. gray) and show details
                    const pObj = dataObj.passengers || {};
                    const transports = childrenList.map(c => {
                        const optId = pObj[c.id] || 'none';
                        if (optId === 'none') return null;
                        const opt = driverOptions.find(d => d.id === optId);
                        return { child: c.name, driver: opt };
                    }).filter(x => x);

                    let bgColor = 'bg-gray-100 border border-gray-300 text-gray-500 border-dashed';
                    let contentHtml = '';
                    const title = type === 'morning' ? 'Aller' : 'Retour';

                    if (transports.length === 0) {
                        contentHtml = `<div class="font-semibold text-center text-[10px] leading-tight flex flex-col justify-center h-full">${title} (Départ ${time})<br>À définir</div>`;
                    } else {
                        // If all active transports use the same driver, use that color.
                        const allSameDriver = transports.every(t => t.driver.id === transports[0].driver.id);
                        if (allSameDriver && transports[0].driver.id !== 'none') {
                            bgColor = transports[0].driver.color + ' text-white';
                        } else {
                            bgColor = 'bg-gray-800 text-white'; // Mixed drivers, use dark theme
                        }

                        let linesHtml = transports.map(t => {
                            let icon = '🚗';
                            if (t.driver.id === 'train') icon = '🚆';
                            return `<div class="text-[10px] opacity-90 truncate flex justify-between">
                                <span>${t.child}</span><span>${icon} ${t.driver.label.replace(' 🚆','').replace(' ❌','')}</span>
                            </div>`;
                        }).join('');

                        contentHtml = `
                            <div class="flex justify-between font-bold text-[10px] mb-1 border-b border-white/20 pb-0.5">
                                <span>${title}</span> <span>Départ ${time}</span>
                            </div>
                            <div class="flex flex-col gap-0.5">${linesHtml}</div>
                        `;
                    }
                    
                    // Adjust height if many lines
                    const height = transports.length > 1 ? 55 : 46;

                    // Align morning blocks above the line, evening blocks below the line to avoid overlap with classes
                    let yOffset = 0;
                    if (type === 'morning') {
                        // Le trajet dure 15 min. On veut que le bas du bloc (qui fait 46px/55px)
                        // s'arrête exactement à (Heure de départ + 15 min), ce qui correspond
                        // parfaitement au début du cours !
                        const tripDurationPx = 15 * pxPerMinute; // 22.5px
                        yOffset = tripDurationPx - height;
                    } else {
                        yOffset = 0;
                    }

                    block.className = `absolute w-11/12 left-[4%] rounded shadow-md cursor-pointer hover:shadow-lg transition p-2 flex flex-col justify-center ${bgColor}`;
                    block.style.top = `${Math.max(0, top + yOffset)}px`;
                    block.style.height = `${height}px`;
                    block.style.zIndex = '20';
                    block.innerHTML = contentHtml;

                    block.onclick = () => openModal(dateStr, type, dayData, sEvents);
                    eventsContainer.appendChild(block);
                }
            };

            drawTrip('morning', dayData.morning);
            drawTrip('evening', dayData.evening);

            col.appendChild(eventsContainer);
            grid.appendChild(col);
        }
    }

    fetchSchedule(formatDate(currentDate), formatDate(currentDate)).then(data => {
        if(data) showApp();
    });
});
