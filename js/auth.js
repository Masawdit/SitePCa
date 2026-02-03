// Authentication Module

const Auth = {
    // Get current user
    async getUser() {
        const { data: { user } } = await db.auth.getUser();
        return user;
    },

    // Check if user is logged in and is an admin
    async requireAdmin() {
        const user = await this.getUser();

        if (!user) {
            const currentPath = window.location.pathname;
            const loginPath = currentPath.includes('/admin/') ? '../login.html' : 'login.html';
            window.location.href = loginPath;
            return null;
        }

        // Verify user is in admins table
        const { data: admin, error } = await db
            .from('admins')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error || !admin) {
            await this.logout();
            return null;
        }

        return admin;
    },

    // Login with email and password
    async login(email, password) {
        const { data, error } = await db.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            throw new Error(error.message);
        }

        // Verify user is an admin
        const { data: admin, error: adminError } = await db
            .from('admins')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (adminError || !admin) {
            await this.logout();
            throw new Error('Vous n\'êtes pas autorisé en tant qu\'admin');
        }

        return { user: data.user, admin };
    },

    // Register with invite token
    async register(email, password, displayName, inviteToken) {
        // Validate invite token first
        const { data: invite, error: inviteError } = await db
            .from('admin_invites')
            .select('*')
            .eq('token', inviteToken)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (inviteError || !invite) {
            throw new Error('Invitation invalide ou expirée');
        }

        // Check if email matches invite
        if (invite.email.toLowerCase() !== email.toLowerCase()) {
            throw new Error('L\'email ne correspond pas à l\'invitation');
        }

        // Create auth user
        const { data: authData, error: authError } = await db.auth.signUp({
            email: email.trim(),
            password: password
        });

        if (authError) {
            throw new Error(authError.message);
        }

        // Wait a moment for the auth user to be created
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create admin record
        const { error: adminError } = await db
            .from('admins')
            .insert({
                id: authData.user.id,
                email: email.trim(),
                display_name: displayName.trim(),
                invited_by: invite.invited_by
            });

        if (adminError) {
            console.error('Admin creation error:', adminError);
            throw new Error('Échec de la création du profil admin');
        }

        // Mark invite as used
        await db
            .from('admin_invites')
            .update({ used_at: new Date().toISOString() })
            .eq('id', invite.id);

        return authData;
    },

    // Logout
    async logout() {
        await db.auth.signOut();
        // Get the correct path to login.html (handle both root and admin subfolder)
        const currentPath = window.location.pathname;
        const loginPath = currentPath.includes('/admin/') ? '../login.html' : 'login.html';
        window.location.href = loginPath;
    },

    // Check invite token validity
    async validateInviteToken(token) {
        const { data: invite, error } = await db
            .from('admin_invites')
            .select('*')
            .eq('token', token)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !invite) {
            return null;
        }

        return invite;
    },

    // Create invite (for logged in admins)
    async createInvite(email) {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Non authentifié');
        }

        const token = Utils.generateInviteToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        const { data, error } = await db
            .from('admin_invites')
            .insert({
                email: email.trim().toLowerCase(),
                invited_by: user.id,
                token: token,
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Une invitation pour cet email existe déjà');
            }
            throw new Error(error.message);
        }

        return data;
    },

    // Listen for auth state changes
    onAuthStateChange(callback) {
        return db.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
};
