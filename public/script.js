document.addEventListener('DOMContentLoaded', () => {
    const playlistContainer = document.getElementById('playlist-container');
    const tracksContainer = document.getElementById('tracks-container');
    const tracksList = document.getElementById('tracks-list');
    const reorganizationControls = document.getElementById('playlist-details');
    const newPlaylistNameInput = document.getElementById('new-playlist-name');
    const blocksContainer = document.getElementById('blocks-container');
    const addBlockButton = document.getElementById('add-block');
    const reorganizeButton = document.getElementById('reorganize');
    const connectSpotifyButton = document.getElementById('connect-btn');
    const connectSpotifyDiv = document.getElementById('connect-spotify');
    const totalTracksInfo = document.createElement('div'); // Exibir informações de quantidade de músicas
    let tracks = [];

    // Variáveis para armazenar BPM mínimo e máximo da playlist
    let minBPM = 0;
    let maxBPM = 300;

    // Conectar ao Spotify
    connectSpotifyButton.addEventListener('click', () => {
        window.location.href = '/login';
    });

    // Função para validar se o nome da playlist está preenchido
    function validateNewPlaylistName() {
        const isPlaylistNameFilled = !!newPlaylistNameInput.value.trim();
        reorganizeButton.disabled = !isPlaylistNameFilled;
        addBlockButton.disabled = !isPlaylistNameFilled;
    }

    // Monitorar o input do nome da nova playlist
    newPlaylistNameInput.addEventListener('input', validateNewPlaylistName);

    // Desabilitar o botão "Adicionar Bloco" e "Reorganizar" no início
    addBlockButton.disabled = true;
    reorganizeButton.disabled = true;

    // Carregar playlists
    fetch('/api/playlists')
        .then(handleResponse)
        .then(displayPlaylists)
        .catch(handleError);

    function handleResponse(response) {
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
        return response.json();
    }

    function displayPlaylists(playlists) {
        connectSpotifyDiv.style.display = 'none';
        playlistContainer.style.display = 'block';

        const playlistTable = playlists.map(playlist => {
            const imageUrl = playlist.images?.[0]?.url ?? '/api/placeholder/300/300';
            return `
                <tr data-id="${playlist.id}" class="playlist-row">
                    <td><img src="${imageUrl}" alt="Imagem da playlist ${playlist.name}" width="50"></td>
                    <td>${playlist.name}</td>
                    <td>${playlist.owner.display_name}</td>
                    <td>${playlist.tracks.total}</td>
                </tr>
            `;
        }).join('');

        playlistContainer.innerHTML = `<table>
            <tr><th>Imagem</th><th>Nome</th><th>Autor</th><th>Número de músicas</th></tr>
            ${playlistTable}
        </table>`;

        addPlaylistClickEvents();
    }

    function handleError(error) {
        console.error('Erro:', error);
        playlistContainer.innerHTML = `<p>Erro ao carregar playlists: ${error.message}</p>`;
        if (error.message === 'Unauthorized') {
            window.location.href = '/login';
        }
    }

    function addPlaylistClickEvents() {
        document.querySelectorAll('.playlist-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const playlistId = e.currentTarget.getAttribute('data-id');
                fetch(`/api/playlist/${playlistId}/tracks`)
                    .then(handleResponse)
                    .then(fetchedTracks => {
                        tracks = fetchedTracks;
                        calculateBPMRange(tracks); // Calcular BPM mínimo e máximo
                        displaySelectedPlaylistInfo(row);
                        displayTracks(tracks);
                        reorganizationControls.style.display = 'block';
                        tracksList.style.display = 'block';
                        updateTotalTracksInfo(tracks.length); // Atualiza a quantidade total de músicas
                    })
                    .catch(handleError);
            });
        });
    }

    // Calcular o BPM mínimo e máximo com base nas músicas da playlist
    function calculateBPMRange(tracks) {
        minBPM = Math.min(...tracks.map(track => track.tempo));
        maxBPM = Math.max(...tracks.map(track => track.tempo));
    }

    function displaySelectedPlaylistInfo(row) {
        const selectedPlaylistHTML = `
            <h2>Playlist Selecionada</h2>
            <div class="selected-playlist">
                <img src="${row.querySelector('img').src}" alt="Imagem da playlist" width="50">
                <p><strong>${row.querySelector('td:nth-child(2)').textContent}</strong></p>
                <p>${row.querySelector('td:nth-child(3)').textContent}</p>
                <p>${row.querySelector('td:nth-child(4)').textContent} músicas</p>
            </div>
        `;
        playlistContainer.innerHTML = selectedPlaylistHTML;
    }

    function displayTracks(tracks) {
        tracksContainer.innerHTML = ''; // Limpa a lista de músicas antes de exibir a nova lista
        let tracksTable = '<table>';
        tracksTable += `
            <tr>
                <th>#</th><th>Imagem</th><th>Nome</th><th>Artista</th><th>Duração</th><th>Gênero</th>
                <th>Energia</th><th>Dançabilidade</th><th>Popularidade</th><th>BPM</th>
                <th>Mood</th><th>Key</th><th>Início</th>
            </tr>`;

        let totalTime = 0;

        tracks.forEach((track, index) => {
            const popularityHtml = generatePopularityHtml(track.popularity);
            const energyHtml = generateEnergyHtml(track.energy);
            const danceabilityHtml = generateDanceabilityHtml(track.danceability);
            const moodHtml = generateMoodHtml(track.valence);
            const keyHtml = generateKeyHtml(track.key);
            const startTimeFormatted = formatTime(totalTime);

            tracksTable += `
                <tr>
                    <td>${index + 1}</td>
                    <td><img src="${track.image}" alt="Imagem de ${track.name}" width="50"></td>
                    <td>${track.name}</td>
                    <td>${track.artists}</td>
                    <td>${(track.duration_ms / 60000).toFixed(2)} minutos</td>
                    <td>${track.genre || 'Desconhecido'}</td>
                    <td>${energyHtml}</td>
                    <td>${danceabilityHtml}</td>
                    <td>${popularityHtml}</td>
                    <td>${Math.round(track.tempo)}</td>
                    <td>${moodHtml}</td>
                    <td>${keyHtml}</td>
                    <td>${startTimeFormatted}</td>
                </tr>
            `;

            totalTime += track.duration_ms;
        });
        tracksTable += '</table>';
        tracksContainer.innerHTML = tracksTable;
    }

    // Atualizar a interface com as faixas filtradas e marcar blocos
    function updatePlaylistPreview() {
        const blocks = getBlockData();
        const filteredTracks = applyBlocksToTracks(tracks, blocks);

        // Atualiza a visualização na interface, sem gravar no Spotify ainda
        displayTracksWithBlocks(filteredTracks, blocks);
        updateTotalTracksInfo(filteredTracks.length); // Atualiza a quantidade total de músicas
    }

    // Função para exibir as faixas com blocos visíveis
    function displayTracksWithBlocks(tracks, blocks) {
        tracksContainer.innerHTML = ''; // Limpa a lista de músicas antes de exibir a nova lista
        let tracksTable = '<table>';
        tracksTable += `
            <tr>
                <th>#</th><th>Imagem</th><th>Nome</th><th>Artista</th><th>Duração</th><th>Gênero</th>
                <th>Energia</th><th>Dançabilidade</th><th>Popularidade</th><th>BPM</th>
                <th>Mood</th><th>Key</th><th>Início</th>
            </tr>`;

        let totalTime = 0;

        blocks.forEach(block => {
            // Não exibir blocos sem nome
            if (!block.name) return;

            // Adiciona a linha que marca o início do bloco
            tracksTable += `
                <tr class="block-name-row">
                    <td colspan="13">${block.name} - ${block.tracks.length} músicas - Duração Máxima: ${block.duration} min</td>
                </tr>
            `;

            block.tracks.forEach((track, index) => {
                const popularityHtml = generatePopularityHtml(track.popularity);
                const energyHtml = generateEnergyHtml(track.energy);
                const danceabilityHtml = generateDanceabilityHtml(track.danceability);
                const moodHtml = generateMoodHtml(track.valence);
                const keyHtml = generateKeyHtml(track.key);
                const startTimeFormatted = formatTime(totalTime);

                tracksTable += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><img src="${track.image}" alt="Imagem de ${track.name}" width="50"></td>
                        <td>${track.name}</td>
                        <td>${track.artists}</td>
                        <td>${(track.duration_ms / 60000).toFixed(2)} minutos</td>
                        <td>${track.genre || 'Desconhecido'}</td>
                        <td>${energyHtml}</td>
                        <td>${danceabilityHtml}</td>
                        <td>${popularityHtml}</td>
                        <td>${Math.round(track.tempo)}</td>
                        <td>${moodHtml}</td>
                        <td>${keyHtml}</td>
                        <td>${startTimeFormatted}</td>
                    </tr>
                `;

                totalTime += track.duration_ms;
            });
        });

        tracksTable += '</table>';
        tracksContainer.innerHTML = tracksTable;
    }

    // Exibir total de músicas reorganizadas e a quantidade de músicas por bloco
    function updateTotalTracksInfo(totalTracks) {
        totalTracksInfo.innerHTML = `<p>Total de músicas reorganizadas: ${totalTracks}</p>`;
        reorganizationControls.insertBefore(totalTracksInfo, reorganizationControls.firstChild);
    }

    // Reorganizar a playlist ao clicar no botão 'Reorganizar'
    reorganizeButton.addEventListener('click', async () => {
        const newPlaylistName = newPlaylistNameInput.value;
        if (!newPlaylistName) {
            alert("Por favor, insira um nome para a nova playlist.");
            return;
        }

        const blocks = getBlockData();
        const filteredTracks = applyBlocksToTracks(tracks, blocks);

        // Criar a nova playlist com base nas faixas reorganizadas
        try {
            const response = await fetch('/api/reorganize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tracks: filteredTracks.map(track => track.uri),
                    blocks,
                    newPlaylistName
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Falha ao criar a nova playlist: ${errorData.error}`);
            }

            const result = await response.json();
            alert(`Nova playlist "${newPlaylistName}" criada com sucesso! ID: ${result.playlistId}`);
        } catch (error) {
            console.error('Erro ao criar nova playlist:', error);
            alert(`Ocorreu um erro ao criar a nova playlist: ${error.message}`);
        }
    });

    function generatePopularityHtml(popularity) {
        const fullStars = Math.round(popularity / 20);
        const emptyStars = 5 - fullStars;
        return '<div class="popularidade">' + '★'.repeat(fullStars) + '☆'.repeat(emptyStars) + '</div>';
    }

    function generateEnergyHtml(energy) {
        const percentage = (energy * 100).toFixed(0);
        return `<div class="energia" style="position: relative;">
                    <div style="position: absolute; left: ${percentage}%; top: 0; bottom: 0; width: 2px; background-color: black;"></div>
                    <div style="height: 100%; width: 100%; background: linear-gradient(to right, green, red);"></div>`;
    }

    function generateDanceabilityHtml(danceability) {
        const footprints = Math.round(danceability * 5);
        return '<div class="dancabilidade">' + '👣'.repeat(footprints) + '</div>';
    }

    function generateMoodHtml(valence) {
        return valence >= 0.5 ? '<div class="mood">😊</div>' : '<div class="mood">😔</div>';
    }

    function generateKeyHtml(key) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return `<div class="key">${keys[key] || 'Desconhecido'}</div>`;
    }

    function formatTime(totalMilliseconds) {
        const totalMinutes = Math.floor(totalMilliseconds / 60000);
        const minutes = totalMinutes % 60;
        const hours = Math.floor(totalMinutes / 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')} horas`;
        } else {
            return `${minutes} minutos`;
        }
    }

    function getBlockData() {
        return Array.from(blocksContainer.children).map(block => {
            const dimensions = Array.from(block.querySelectorAll('.dimension-set')).map(dimensionSet => {
                const dimension = dimensionSet.querySelector('.dimension-select').value;
                const order = dimensionSet.querySelector('.order') ? dimensionSet.querySelector('.order').value : null;

                let filter = null;
                switch (dimension) {
                    case 'popularity':
                        const popularityFilterElement = dimensionSet.querySelector('.popularity-filter');
                        if (popularityFilterElement) {
                            filter = [...popularityFilterElement.options]
                                .filter(option => option.selected)
                                .map(option => Number(option.value));
                        }
                        break;

                    case 'energy':
                    case 'danceability':
                    case 'valence':
                        const minRangeElement = dimensionSet.querySelector('.range-min');
                        const maxRangeElement = dimensionSet.querySelector('.range-max');
                        if (minRangeElement && maxRangeElement) {
                            filter = {
                                min: parseFloat(minRangeElement.value),
                                max: parseFloat(maxRangeElement.value)
                            };
                        }
                        break;

                    case 'tempo':
                        const bpmMinElement = dimensionSet.querySelector('.range-min');
                        const bpmMaxElement = dimensionSet.querySelector('.range-max');
                        if (bpmMinElement && bpmMaxElement) {
                            filter = {
                                min: parseInt(bpmMinElement.value),
                                max: parseInt(bpmMaxElement.value)
                            };
                        }
                        break;

                    case 'key':
                        const keyFilterElement = dimensionSet.querySelector('.key-filter');
                        if (keyFilterElement) {
                            filter = [...keyFilterElement.options]
                                .filter(option => option.selected)
                                .map(option => option.value);
                        }
                        break;

                    case 'genre':
                        const genreFilterElement = dimensionSet.querySelector('.genre-filter');
                        if (genreFilterElement) {
                            filter = [...genreFilterElement.options]
                                .filter(option => option.selected)
                                .map(option => option.value);
                        }
                        break;
                }

                return { dimension, order, filter };
            });

            return {
                name: block.querySelector('.block-name').value || null, // Exibir apenas blocos com nome
                duration: parseFloat(block.querySelector('.block-duration').value), // Duração do bloco
                dimensions,
                tracks: [] // Armazenar as faixas filtradas
            };
        });
    }

    function applyBlocksToTracks(tracks, blocks) {
        let remainingTracks = [...tracks];

        blocks.forEach(block => {
            if (!block.name) return; // Ignorar blocos sem nome

            let blockTracks = [...remainingTracks];
            let blockTime = 0;

            block.dimensions.forEach(({ dimension, filter, order }) => {
                switch (dimension) {
                    case 'popularity':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => filter.includes(Math.round(track.popularity / 20)));
                        }
                        if (order) {
                            blockTracks.sort((a, b) => order === 'asc' ? a.popularity - b.popularity : b.popularity - a.popularity);
                        }
                        break;
                    case 'energy':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => track.energy >= filter.min && track.energy <= filter.max);
                        }
                        if (order) {
                            blockTracks.sort((a, b) => order === 'asc' ? a.energy - b.energy : b.energy - a.energy);
                        }
                        break;
                    case 'danceability':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => track.danceability >= filter.min && track.danceability <= filter.max);
                        }
                        if (order) {
                            blockTracks.sort((a, b) => order === 'asc' ? a.danceability - b.danceability : b.danceability - a.danceability);
                        }
                        break;
                    case 'valence':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => track.valence >= filter.min && track.valence <= filter.max);
                        }
                        if (order) {
                            blockTracks.sort((a, b) => order === 'asc' ? a.valence - b.valence : b.valence - a.valence);
                        }
                        break;
                    case 'tempo':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => track.tempo >= filter.min && track.tempo <= filter.max);
                        }
                        if (order) {
                            blockTracks.sort((a, b) => order === 'asc' ? a.tempo - b.tempo : b.tempo - a.tempo);
                        }
                        break;
                    case 'key':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => filter.includes(track.key));
                        }
                        break;
                    case 'genre':
                        if (filter) {
                            blockTracks = blockTracks.filter(track => filter.includes(track.genre));
                        }
                        break;
                }
            });

            // Adicionar faixas ao bloco até que a duração máxima seja atingida
            block.tracks = blockTracks.filter(track => {
                const trackDuration = track.duration_ms / 60000; // Converter para minutos
                if (blockTime + trackDuration <= block.duration) {
                    blockTime += trackDuration;
                    return true;
                }
                return false;
            });

            remainingTracks = remainingTracks.filter(track => !block.tracks.includes(track)); // Remover as faixas já alocadas no bloco
        });

        return blocks.flatMap(block => block.tracks); // Retornar todas as faixas alocadas nos blocos
    }

    // Atualizar a interface de visualização ao adicionar blocos ou dimensões
    addBlockButton.addEventListener('click', () => {
        const blockControls = createBlockControls();
        blocksContainer.appendChild(blockControls);
        applyBlockEvents(blockControls); // Aplicar eventos ao novo bloco
        updatePlaylistPreview(); // Atualizar a interface após a criação do bloco
    });

    // Função para criar controles de bloco
    function createBlockControls() {
        const blockControls = document.createElement('div');
        blockControls.className = 'block-controls';
        blockControls.innerHTML = `
            <input type="text" class="block-name" placeholder="Nome do Bloco" required>
            <input type="number" class="block-duration" placeholder="Duração (minutos)" required>
            <div class="dimensions-container">
                <div class="dimension-set">
                    <select class="dimension-select" required>
                        <option value="" disabled selected>Selecionar</option>
                        <option value="popularity">Popularidade</option>
                        <option value="energy">Energia</option>
                        <option value="danceability">Dançabilidade</option>
                        <option value="tempo">BPM</option>
                        <option value="valence">Mood</option>
                        <option value="key">Key</option>
                        <option value="genre">Gênero</option>
                    </select>
                    <div class="dimension-options"></div>
                    <button class="remove-dimension" style="font-size: 18px;">-</button>
                    <button class="add-dimension" style="font-size: 18px;">+</button>
                </div>
            </div>
            <button class="remove-block" style="background-color: red; color: white;">Remover Bloco</button>
        `;

        blockControls.querySelectorAll('button, select').forEach(el => el.disabled = false); // Habilitar os controles

        return blockControls;
    }

    // Aplicar eventos de interação a um novo bloco
    function applyBlockEvents(blockElement) {
        const blockNameInput = blockElement.querySelector('.block-name');
        const blockDurationInput = blockElement.querySelector('.block-duration');

        // Atualização automática ao modificar nome ou duração do bloco
        blockNameInput.addEventListener('input', updatePlaylistPreview);
        blockDurationInput.addEventListener('input', updatePlaylistPreview);

        // Remover bloco
        blockElement.querySelector('.remove-block').addEventListener('click', () => {
            blocksContainer.removeChild(blockElement);
            updatePlaylistPreview(); // Atualizar a interface ao remover um bloco
        });

        // Adicionar dimensão
        blockElement.querySelector('.add-dimension').addEventListener('click', () => {
            const dimensionSet = createDimensionSet();
            blockElement.querySelector('.dimensions-container').appendChild(dimensionSet);
            applyDimensionEvents(dimensionSet);
            updatePlaylistPreview(); // Atualizar a interface ao adicionar uma dimensão
        });

        // Aplicar eventos às dimensões existentes
        blockElement.querySelectorAll('.dimension-set').forEach(applyDimensionEvents);
    }

    // Função para criar um conjunto de controles de dimensão
    function createDimensionSet() {
        const dimensionSet = document.createElement('div');
        dimensionSet.className = 'dimension-set';
        dimensionSet.innerHTML = `
            <select class="dimension-select" required>
                <option value="" disabled selected>Selecionar</option>
                <option value="popularity">Popularidade</option>
                <option value="energy">Energia</option>
                <option value="danceability">Dançabilidade</option>
                <option value="tempo">BPM</option>
                <option value="valence">Mood</option>
                <option value="key">Key</option>
                <option value="genre">Gênero</option>
            </select>
            <div class="dimension-options"></div>
            <button class="remove-dimension" style="font-size: 18px;">-</button>
        `;
        return dimensionSet;
    }

    // Aplicar eventos a uma nova dimensão
    function applyDimensionEvents(dimensionSet) {
        const dimensionSelect = dimensionSet.querySelector('.dimension-select');
        const dimensionOptions = dimensionSet.querySelector('.dimension-options');
        const removeDimensionButton = dimensionSet.querySelector('.remove-dimension');

        dimensionSelect.addEventListener('change', () => {
            const selectedDimension = dimensionSelect.value;
            dimensionOptions.innerHTML = ''; // Limpar opções anteriores

            // Adicionar as opções específicas com base na dimensão selecionada
            switch (selectedDimension) {
                case 'popularity':
                    dimensionOptions.innerHTML = `
                        <label>Filtro de Popularidade (estrelas):</label>
                        <select multiple class="popularity-filter">
                            <option value="1">1 estrela</option>
                            <option value="2">2 estrelas</option>
                            <option value="3">3 estrelas</option>
                            <option value="4">4 estrelas</option>
                            <option value="5">5 estrelas</option>
                        </select>
                        <label>Ordenar:</label>
                        <select class="order">
                            <option value="asc">Ascendente</option>
                            <option value="desc">Descendente</option>
                        </select>
                    `;
                    break;

                case 'energy':
                case 'danceability':
                case 'valence':
                    dimensionOptions.innerHTML = `
                        <label>Intervalo:</label>
                        De <input type="number" class="range-min" min="0" max="1" step="0.1" value="0">
                        a <input type="number" class="range-max" min="0" max="1" step="0.1" value="1">
                        <label>Ordenar:</label>
                        <select class="order">
                            <option value="asc">Ascendente</option>
                            <option value="desc">Descendente</option>
                        </select>
                    `;
                    break;

                case 'tempo': // BPM
                    dimensionOptions.innerHTML = `
                        <label>Intervalo BPM:</label>
                        De <input type="number" class="range-min" min="${minBPM}" max="${maxBPM}" step="1" value="${minBPM}">
                        a <input type="number" class="range-max" min="${minBPM}" max="${maxBPM}" step="1" value="${maxBPM}">
                        <label>Ordenar:</label>
                        <select class="order">
                            <option value="asc">Ascendente</option>
                            <option value="desc">Descendente</option>
                        </select>
                    `;
                    break;

                case 'key':
                    dimensionOptions.innerHTML = `
                        <label>Tonalidade (Key):</label>
                        <select multiple class="key-filter">
                            <option value="C">C major</option>
                            <option value="C#">C# major</option>
                            <option value="D">D major</option>
                            <option value="A minor">A minor</option>
                            <option value="G major">G major</option>
                        </select>
                    `;
                    break;

                case 'genre':
                    dimensionOptions.innerHTML = `
                        <label>Gênero:</label>
                        <select multiple class="genre-filter">
                            <option value="Rock">Rock</option>
                            <option value="Pop">Pop</option>
                            <option value="Jazz">Jazz</option>
                            <option value="Classical">Classical</option>
                        </select>
                    `;
                    break;
            }
            updatePlaylistPreview(); // Atualizar a interface ao modificar a dimensão
        });

        removeDimensionButton.addEventListener('click', () => {
            dimensionSet.remove();
            updatePlaylistPreview(); // Atualizar a interface ao remover uma dimensão
        });

        // Atualizar automaticamente a lista quando a dimensão for alterada
        dimensionSelect.addEventListener('change', updatePlaylistPreview);
    }
});