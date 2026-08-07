import { useEffect, useState } from 'react';
import { Briefcase, Plus, ExternalLink, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateJobModal } from './CreateJobModal';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  technicality: string[];
  hrContact: string;
  status: string;
  linkedinPostUrl?: string;
  createdAt: string;
}

export function JobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await api.get('/jobs');
      setJobs(res.data.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreateJob = async (data: { title: string; description: string; technicality: string[]; hrContact: string }) => {
    setSubmitting(true);
    try {
      await api.post('/jobs', data);
      toast.success('Job posting created and automated to LinkedIn!');
      setModalOpen(false);
      fetchJobs();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            Recruitment
          </h1>
          <p className="text-muted-foreground">Manage your job postings and LinkedIn automation</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Job Post
        </Button>
      </div>

      {!jobs.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Linkedin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Job Postings Yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
              Create your first job posting. If you have configured your LinkedIn Token in Settings, it will automatically post to your feed.
            </p>
            <Button onClick={() => setModalOpen(true)}>Create Job Post</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.id} className="flex flex-col h-full bg-background/60 backdrop-blur-md border-border/40 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold line-clamp-1" title={job.title}>
                    {job.title}
                  </CardTitle>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    job.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    job.status === 'FAILED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  HR Contact: {job.hrContact}
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm text-foreground/80 line-clamp-3 mb-4 flex-1">
                  {job.description}
                </p>
                
                {job.technicality?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {job.technicality.slice(0, 3).map((skill, idx) => (
                      <span key={idx} className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">
                        {skill}
                      </span>
                    ))}
                    {job.technicality.length > 3 && (
                      <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">
                        +{job.technicality.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {job.linkedinPostUrl && (
                  <Button variant="outline" size="sm" className="w-full mt-auto" asChild>
                    <a href={job.linkedinPostUrl} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-3 w-3 mr-2" />
                      View on LinkedIn
                      <ExternalLink className="h-3 w-3 ml-2 text-muted-foreground" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateJobModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleCreateJob}
        loading={submitting}
      />
    </div>
  );
}
