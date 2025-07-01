'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

type FormData = {
  userId: string;
  title: string;
  message: string;
};

export default function TestPushPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: data.userId,
          title: data.title,
          message: data.message,
          data: {
            testId: Date.now().toString(),
            actionUrl: '/employee/dashboard',
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send push notification');
      }

      toast({
        title: 'Push notification sent',
        description: `Successfully sent to user ${data.userId}`,
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send push notification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Test Push Notifications</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Send Test Push Notification</CardTitle>
          <CardDescription>
            Send a test push notification to a specific user. The user must have a registered device token.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                {...register('userId', { required: true })}
              />
              {errors.userId && <p className="text-sm text-red-500">User ID is required</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Notification Title</Label>
              <Input
                id="title"
                placeholder="Enter notification title"
                defaultValue="Test Notification"
                {...register('title', { required: true })}
              />
              {errors.title && <p className="text-sm text-red-500">Title is required</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Notification Message</Label>
              <Textarea
                id="message"
                placeholder="Enter notification message"
                defaultValue="This is a test push notification from the Employee Management System"
                {...register('message', { required: true })}
              />
              {errors.message && <p className="text-sm text-red-500">Message is required</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Push Notification
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 