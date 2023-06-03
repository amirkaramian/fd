using FluentAssertions;
using NUnit.Framework;
using Todo_App.Application.Common.Exceptions;
using Todo_App.Application.TodoLists.Commands.CreateTodoList;
using Todo_App.Application.TodoLists.Commands.DeleteTodoList;
using Todo_App.Domain.Entities;
using Todo_App.Domain.ValueObjects;

namespace Todo_App.Application.IntegrationTests.TodoLists.Commands;

using static Testing;

public class DeleteTodoListTests : BaseTestFixture
{
    [Test]
    public async Task ShouldRequireValidTodoListId()
    {
        var command = new DeleteTodoListCommand(99);
        await FluentActions.Invoking(() => SendAsync(command)).Should().ThrowAsync<NotFoundException>();
    }

    [Test]
    public async Task ShouldDeleteTodoList()
    {
        var listId = await SendAsync(new CreateTodoListCommand
        {
            Title = "New List"
        });

        await SendAsync(new DeleteTodoListCommand(listId));

        var list = await FindAsync<TodoList>(listId);

        list.Should().BeNull();
    }
    [Test]
    public async Task ShouldSafeDeleteTodoList()
    {
        var listId = await SendAsync(new CreateTodoListCommand
        {
            Title = "New List",
        });

        int countBefore = await CountAsync<TodoList>();
        await SendAsync(new DeleteTodoListCommand(listId));
        var countAfter = await CountWithIgnoreFilterAsync<TodoList>(listId);

        countBefore.Should().Be(countAfter);
    }
}
