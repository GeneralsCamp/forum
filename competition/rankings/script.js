const supabaseUrl = 'https://piycuuegsjpuojpcaeqw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeWN1dWVnc2pwdW9qcGNhZXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjk0MDksImV4cCI6MjA2NDgwNTQwOX0.thfjZUrxKAdfwStaeWjpEyZ-C70kUuWnjIontibhkxc';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

async function loadLeaderboard() {
    try {
        const { data, error } = await supabaseClient
            .from('quiz_rankings')
            .select('*')
            .order('score', { ascending: false })
            .order('discord_name', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Hiba a ranglista betöltésekor:', error);
            return;
        }

        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="game-col">${item.game || 'N/A'}</td>
                <td class="name-col">${item.discord_name || 'Ismeretlen'}</td>
                <td class="score-col">${item.score ?? 0}</td>
            `;

            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Nem sikerült betölteni a ranglistát:', err);
    }
}

document.addEventListener('DOMContentLoaded', loadLeaderboard);