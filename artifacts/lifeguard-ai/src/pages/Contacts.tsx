import { useState } from 'react';
import { useListContacts, useCreateContact, useDeleteContact } from '@workspace/api-client-react';
import { Users, UserPlus, Phone, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Contacts() {
  const { data: contacts, isLoading, refetch } = useListContacts();
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', relationship: 'Family', isPrimary: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createContact.mutate({ data: formData }, {
      onSuccess: () => {
        toast.success("Contact added");
        setShowForm(false);
        setFormData({ name: '', phone: '', relationship: 'Family', isPrimary: false });
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Remove emergency contact?")) {
      deleteContact.mutate({ id }, {
        onSuccess: () => {
          toast.success("Contact removed");
          refetch();
        }
      });
    }
  };

  return (
    <div className="p-6 flex flex-col min-h-full animate-in fade-in duration-300">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="text-primary w-6 h-6" />
          <h1 className="text-xl font-bold font-mono tracking-wider">CONTACTS</h1>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "p-2 rounded-full transition-colors",
            showForm ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
          )}
        >
          {showForm ? <Trash2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card p-5 rounded-2xl border border-border mb-6 space-y-4 shadow-xl">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase">Name</label>
            <input 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 mt-1 text-sm focus:ring-1 ring-primary outline-none" 
            />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase">Phone</label>
            <input 
              required
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 mt-1 text-sm focus:ring-1 ring-primary outline-none" 
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={createContact.isPending} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm">
              SAVE CONTACT
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-card rounded-2xl"></div>
            <div className="h-20 bg-card rounded-2xl"></div>
          </div>
        ) : contacts?.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground text-sm font-mono">No contacts added.</p>
          </div>
        ) : (
          contacts?.map(contact => (
            <div key={contact.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-lg text-muted-foreground uppercase">
                  {contact.name.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">{contact.name}</h3>
                    {contact.isPrimary && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-1">
                    <Phone className="w-3 h-3" />
                    {contact.phone}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(contact.id)}
                className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}