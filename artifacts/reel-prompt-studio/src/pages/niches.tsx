import { useState, useRef } from "react";
import { useListNiches, useCreateNiche, useUpdateNiche, useDeleteNiche, getListNichesQueryKey, getGetDashboardSummaryQueryKey, getListRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Layers, Search, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatDistanceToNow } from "date-fns";

const nicheSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  audience: z.string().min(1, "Audience is required"),
  contentAngle: z.string().min(1, "Content angle is required"),
});

export default function Niches() {
  const { data: niches, isLoading } = useListNiches();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const filteredNiches = niches?.filter(n => 
    n.name.toLowerCase().includes(search.toLowerCase()) || 
    n.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="size-8 text-primary" /> Niches
          </h1>
          <p className="text-muted-foreground mt-2">Define isolated workspaces for your content targets.</p>
        </div>
        
        <NicheDialog 
          open={isCreateOpen} 
          onOpenChange={setIsCreateOpen} 
          title="Create New Niche" 
        >
          <Button className="shadow-md shadow-primary/20"><Plus className="mr-2 size-4" /> New Niche</Button>
        </NicheDialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Search niches..." 
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 flex-1 pb-10">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-64 flex flex-col justify-between">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2"/><Skeleton className="h-4 w-full"/></CardHeader>
              <CardContent><Skeleton className="h-20 w-full"/></CardContent>
            </Card>
          ))
        ) : filteredNiches?.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
            <Layers className="size-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No niches found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {search ? "No niches match your search." : "Create a niche to start organizing your prompt generation workflows."}
            </p>
            {!search && (
              <Button variant="outline" className="mt-6" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 size-4" /> Create your first Niche
              </Button>
            )}
          </div>
        ) : (
          filteredNiches?.map((niche) => (
            <Card key={niche.id} className="flex flex-col group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-xl line-clamp-1">{niche.name}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <NicheDialog 
                      open={editingId === niche.id} 
                      onOpenChange={(open) => setEditingId(open ? niche.id : null)}
                      title="Edit Niche"
                      defaultValues={niche}
                      nicheId={niche.id}
                    >
                      <Button variant="ghost" size="icon" className="size-8"><Edit2 className="size-4" /></Button>
                    </NicheDialog>
                    <DeleteDialog nicheId={niche.id} nicheName={niche.name}>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></Button>
                    </DeleteDialog>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 min-h-10">{niche.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 text-sm">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target Audience</div>
                  <div className="line-clamp-2 bg-muted/50 p-2 rounded-md border border-border/50">{niche.audience}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Content Angle</div>
                  <div className="line-clamp-2 bg-muted/50 p-2 rounded-md border border-border/50">{niche.contentAngle}</div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border pt-4 text-xs text-muted-foreground flex justify-between items-center bg-card/50">
                <span>Updated {formatDistanceToNow(new Date(niche.updatedAt), { addSuffix: true })}</span>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function NicheDialog({ 
  open, 
  onOpenChange, 
  title, 
  children, 
  defaultValues,
  nicheId 
}: { 
  open: boolean, 
  onOpenChange: (o: boolean) => void, 
  title: string, 
  children: React.ReactNode,
  defaultValues?: { name: string, description: string, audience: string, contentAngle: string },
  nicheId?: number
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateNiche();
  const updateMutation = useUpdateNiche();
  
  const form = useForm<z.infer<typeof nicheSchema>>({
    resolver: zodResolver(nicheSchema),
    defaultValues: defaultValues || {
      name: "",
      description: "",
      audience: "",
      contentAngle: ""
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: z.infer<typeof nicheSchema>) {
    if (nicheId) {
      updateMutation.mutate(
        { nicheId, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListNichesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListRecentActivityQueryKey() });
            toast({ title: "Niche updated" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error updating niche", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListNichesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListRecentActivityQueryKey() });
            toast({ title: "Niche created" });
            form.reset();
            onOpenChange(false);
          },
          onError: () => toast({ title: "Error creating niche", variant: "destructive" })
        }
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if(!val) form.reset(defaultValues || {name:"", description:"", audience:"", contentAngle:""});
      onOpenChange(val);
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Define the creative boundaries for this content vertical.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niche Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Finance Tech Bros" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this niche about?" className="resize-none h-20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the demographics and psychographics" className="resize-none h-20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contentAngle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Angle / Voice</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Edgy, educational, high-energy" className="resize-none h-20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Niche"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ nicheId, nicheName, children }: { nicheId: number, nicheName: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteNiche();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Niche?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the <strong>{nicheName}</strong> niche? This will also delete all related analyses and prompt packs. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            variant="destructive" 
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate(
                { nicheId },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListNichesQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getListRecentActivityQueryKey() });
                    toast({ title: "Niche deleted" });
                    setOpen(false);
                  },
                  onError: () => toast({ title: "Error deleting niche", variant: "destructive" })
                }
              );
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
