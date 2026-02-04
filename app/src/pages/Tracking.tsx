import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tracking, projects, keywords } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Play, TestTube, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { AIPlatform } from '../types';

const platforms = Object.values(AIPlatform);

export default function Tracking() {
  const [selectedProject, setSelectedProject] = useState('');
  const [testKeyword, setTestKeyword] = useState('');
  const [testDomain, setTestDomain] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<AIPlatform[]>([AIPlatform.GEMINI, AIPlatform.GOOGLE_AI_OVERVIEW]);
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const queryClient = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const { data: keywordsData } = useQuery({
    queryKey: ['keywords', selectedProject],
    queryFn: () => keywords.list(selectedProject),
    enabled: !!selectedProject,
  });

  const { data: trackingStatus } = useQuery({
    queryKey: ['tracking-status', selectedProject],
    queryFn: () => tracking.status(selectedProject),
    enabled: !!selectedProject,
    refetchInterval: 30000,
  });

  const trackProjectMutation = useMutation({
    mutationFn: ({ projectId, platforms }: { projectId: string; platforms?: AIPlatform[] }) =>
      tracking.trackProject(projectId, { platforms }),
    onSuccess: () => {
      toast.success('Tracking started for project');
      queryClient.invalidateQueries({ queryKey: ['tracking-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start tracking');
    },
  });

  const handleQuickTest = async () => {
    if (!testKeyword) {
      toast.error('Please enter a keyword');
      return;
    }
    setIsTesting(true);
    try {
      const results = await tracking.quickTest(testKeyword, testDomain, selectedPlatforms);
      setTestResults(results);
    } catch (error: any) {
      toast.error(error.message || 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const togglePlatform = (platform: AIPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tracking</h1>
        <p className="text-muted-foreground">Track your keywords across AI platforms</p>
      </div>

      {/* Quick Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Quick Test
          </CardTitle>
          <CardDescription>
            Test a keyword without saving results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Keyword</label>
              <Input
                placeholder="Enter keyword or question..."
                value={testKeyword}
                onChange={(e) => setTestKeyword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Domain (optional)</label>
              <Input
                placeholder="example.com"
                value={testDomain}
                onChange={(e) => setTestDomain(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleQuickTest}
                disabled={isTesting || !testKeyword}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedPlatforms.includes(platform)}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <span className="text-sm">{platform.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {testResults && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-3">Test Results for "{testResults.keyword}"</h4>
              <div className="space-y-2">
                {testResults.results.map((result: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        result.citationFound ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-amber-500" />
                        )
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium capitalize">
                          {result.platform.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.success
                            ? result.citationFound
                              ? `Cited at position ${result.position}`
                              : 'Not cited'
                            : `Error: ${result.error}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.responseTimeMs}ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Project Tracking
          </CardTitle>
          <CardDescription>
            Track all keywords in a project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projectsData?.projects?.map((project: any) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() =>
                selectedProject &&
                trackProjectMutation.mutate({ projectId: selectedProject, platforms: selectedPlatforms })
              }
              disabled={!selectedProject || trackProjectMutation.isPending}
            >
              {trackProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Track Project
                </>
              )}
            </Button>
          </div>

          {trackingStatus && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-3">Tracking Status</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold">{trackingStatus.totalKeywords}</div>
                  <div className="text-sm text-muted-foreground">Total Keywords</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{trackingStatus.trackedKeywords}</div>
                  <div className="text-sm text-muted-foreground">Tracked</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{trackingStatus.pendingKeywords}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>
              {trackingStatus.lastTrackTime && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Last tracked: {new Date(trackingStatus.lastTrackTime).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {keywordsData?.keywords && keywordsData.keywords.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-3">Keywords ({keywordsData.keywords.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {keywordsData.keywords.map((keyword: any) => (
                  <div
                    key={keyword.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-md"
                  >
                    <div>
                      <div className="font-medium">{keyword.keyword_text}</div>
                      <div className="text-sm text-muted-foreground">
                        Priority: {keyword.priority_level} | Stage: {keyword.funnel_stage}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {keyword.last_tracked_at ? (
                        <Badge variant="outline" className="text-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Tracked
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
