import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; technicality: string[]; hrContact: string }) => void;
  loading?: boolean;
}

export function CreateJobModal({ open, onOpenChange, onSubmit, loading }: CreateJobModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techInput, setTechInput] = useState('');
  const [technicality, setTechnicality] = useState<string[]>([]);
  const [hrContact, setHrContact] = useState('');

  const handleAddSkill = () => {
    if (techInput.trim() && !technicality.includes(techInput.trim())) {
      setTechnicality([...technicality, techInput.trim()]);
      setTechInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setTechnicality(technicality.filter((s) => s !== skill));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description, technicality, hrContact });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Job Posting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Developer"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role and responsibilities..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Technical Skills</Label>
            <div className="flex gap-2">
              <Input
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                placeholder="e.g. React, Node.js"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={handleAddSkill}>
                Add
              </Button>
            </div>
            {technicality.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {technicality.map((skill) => (
                  <span
                    key={skill}
                    className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:text-red-500 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>HR Contact</Label>
            <Input
              required
              value={hrContact}
              onChange={(e) => setHrContact(e.target.value)}
              placeholder="e.g. hr@company.com or +1 234 567 8900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Posting...' : 'Post to LinkedIn'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
